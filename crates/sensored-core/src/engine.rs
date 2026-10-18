//! Match collection, overlap grouping and rendering. Mirrors `engine.ts`.
//!
//! `detect_and_render` is the seam shared by complete-string processing and
//! the stream core. The hybrid binding splits it: `detect_matches` here, plus
//! the caller's JS detections, then `render_detected`.

use std::borrow::Cow;
use std::cmp::Ordering;
use std::collections::HashSet;
use std::sync::LazyLock;

use regex::Regex;

use crate::detector::Input;
use crate::render::resolve_replacement;
use crate::types::{
    ActiveRule, AppliedMatch, Detection, InspectedMatch, Inspection, InspectionGroup,
    RestorationContext,
};

/// A run of output text; `group` is set for replacements when reporting.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Segment<'t> {
    pub text: Cow<'t, str>,
    pub group: Option<InspectionGroup>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rendered<'t> {
    pub segments: Vec<Segment<'t>>,
    pub groups: Vec<InspectionGroup>,
    /// Byte offset up to which the text has been rendered.
    pub consumed: usize,
}

/// Inputs to rendering that stay fixed across calls.
#[derive(Debug, Clone, Copy)]
pub struct RenderOptions<'o> {
    pub report: bool,
    pub detect_only: bool,
    pub allowlist: &'o HashSet<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Span {
    start: usize,
    end: usize,
}

// ---------------------------------------------------------------------------
// Collection and filtering
// ---------------------------------------------------------------------------

/// Runs every rule's detector over `text`.
pub fn detect_matches<'r>(text: &str, rules: &'r [ActiveRule]) -> Vec<AppliedMatch<'r>> {
    let mut matches = Vec::new();
    let mut found = Vec::new();
    let input = Input::new(text);

    for rule in rules {
        rule.detector.detect_in(&input, &mut found);

        matches.extend(
            found
                .drain(..)
                .map(|detection| AppliedMatch { detection, rule }),
        );
    }

    matches
}

/// Detects, then drops matches that overlap existing placeholders or are
/// allowlisted. Mirrors `collectMatches`.
pub fn collect_matches<'r>(
    text: &str,
    rules: &'r [ActiveRule],
    allowlist: &HashSet<String>,
) -> Vec<AppliedMatch<'r>> {
    filter_detected(text, detect_matches(text, rules), allowlist)
}

/// A non-empty span of `text` on char boundaries: the contract for
/// caller detections.
pub fn is_valid_span(text: &str, detection: &Detection) -> bool {
    detection.start < detection.end
        && detection.end <= text.len()
        && text.is_char_boundary(detection.start)
        && text.is_char_boundary(detection.end)
}

/// Drops matches that overlap existing placeholders or are allowlisted.
/// Mirrors `filterMatches`.
pub fn filter_detected<'r>(
    text: &str,
    matches: Vec<AppliedMatch<'r>>,
    allowlist: &HashSet<String>,
) -> Vec<AppliedMatch<'r>> {
    filter_matches(text, matches, allowlist, &placeholder_spans(text))
}

/// Spans of `[UPPERCASE]` / `[UPPERCASE_N]` placeholders already in the text,
/// so re-redacting redacted text is a no-op.
fn placeholder_spans(text: &str) -> Vec<Span> {
    static REDACT_SPAN: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"\[[A-Z][A-Z0-9_]*\]").expect("valid pattern"));

    REDACT_SPAN
        .find_iter(text)
        .map(|found| Span {
            start: found.start(),
            end: found.end(),
        })
        .collect()
}

fn filter_matches<'r>(
    text: &str,
    matches: Vec<AppliedMatch<'r>>,
    allowlist: &HashSet<String>,
    placeholders: &[Span],
) -> Vec<AppliedMatch<'r>> {
    matches
        .into_iter()
        .filter(|m| {
            let Detection { start, end, .. } = m.detection;

            let overlaps_placeholder = placeholders.iter().any(|p| start < p.end && end > p.start);

            !overlaps_placeholder && !allowlist.contains(&text[start..end])
        })
        .collect()
}

/// Moves `flush_point` back so it never cuts through a span, repeating until
/// none crosses it. Filtered spans count too: cutting through an allowlisted
/// value lets the next flush re-detect its tail as a new match.
fn hold_back_flush(flush_point: usize, spans: impl Iterator<Item = Span> + Clone) -> usize {
    let mut held = flush_point;
    let mut moved = true;

    while moved {
        moved = false;

        for span in spans.clone() {
            if span.start < held && span.end > held {
                held = span.start;
                moved = true;
            }
        }
    }

    held
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/// Start, then end, then rule id. The sort is stable, as in JS.
fn compare_matches(a: &AppliedMatch<'_>, b: &AppliedMatch<'_>) -> Ordering {
    a.detection
        .start
        .cmp(&b.detection.start)
        .then(a.detection.end.cmp(&b.detection.end))
        .then_with(|| a.detection.rule_id.cmp(&b.detection.rule_id))
}

struct MatchGroup<'m, 'r> {
    contributors: &'m [AppliedMatch<'r>],
    start: usize,
    end: usize,
}

/// Groups sorted matches whose spans transitively overlap. Touching spans
/// stay separate.
fn group_overlapping<'m, 'r>(sorted: &'m [AppliedMatch<'r>]) -> Vec<MatchGroup<'m, 'r>> {
    let mut groups = Vec::new();
    let mut index = 0;

    while index < sorted.len() {
        let first = index;
        let start = sorted[index].detection.start;
        let mut end = sorted[index].detection.end;
        index += 1;

        while index < sorted.len() && sorted[index].detection.start < end {
            end = end.max(sorted[index].detection.end);
            index += 1;
        }

        groups.push(MatchGroup {
            contributors: &sorted[first..index],
            start,
            end,
        });
    }

    groups
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/// Renders `text[start_cursor..]` up to `flush_point`, stopping early before
/// any group that crosses it. Mirrors `renderSafePortion` / `renderMatches`.
pub fn render_matches<'t>(
    text: &'t str,
    mut matches: Vec<AppliedMatch<'_>>,
    flush_point: usize,
    start_cursor: usize,
    mut restoration: Option<&mut RestorationContext>,
    options: RenderOptions<'_>,
) -> Rendered<'t> {
    matches.sort_by(compare_matches);

    let groups = group_overlapping(&matches);

    let mut effective_flush = flush_point;

    for group in &groups {
        if group.end > flush_point && group.start < effective_flush {
            effective_flush = group.start;
        }
    }

    let mut rendered = Rendered {
        segments: Vec::new(),
        groups: Vec::new(),
        consumed: effective_flush,
    };

    if effective_flush <= start_cursor {
        return rendered;
    }

    let mut cursor = start_cursor;

    for group in &groups {
        if group.end > effective_flush {
            break;
        }

        if group.start < start_cursor {
            continue;
        }

        let replacement = if options.detect_only {
            text[group.start..group.end].to_owned()
        } else {
            resolve_replacement(
                text,
                group.contributors,
                group.start,
                group.end,
                restoration.as_deref_mut(),
            )
        };

        if group.start > cursor {
            rendered.segments.push(Segment {
                text: Cow::Borrowed(&text[cursor..group.start]),
                group: None,
            });
        }

        if options.report {
            let inspection = InspectionGroup {
                start: group.start,
                end: group.end,
                replacement: replacement.clone(),
                matches: group
                    .contributors
                    .iter()
                    .map(|m| InspectedMatch {
                        detection: m.detection.clone(),
                        value: text[m.detection.start..m.detection.end].to_owned(),
                    })
                    .collect(),
            };

            rendered.groups.push(inspection.clone());
            rendered.segments.push(Segment {
                text: Cow::Owned(replacement),
                group: Some(inspection),
            });
        } else {
            rendered.segments.push(Segment {
                text: Cow::Owned(replacement),
                group: None,
            });
        }

        cursor = group.end;
    }

    if effective_flush > cursor {
        rendered.segments.push(Segment {
            text: Cow::Borrowed(&text[cursor..effective_flush]),
            group: None,
        });
    }

    rendered
}

/// Holds the flush point back from every detected span and placeholder, then
/// filters and renders. The hybrid seam: `detected` may mix core and caller
/// detections.
pub fn render_detected<'t>(
    text: &'t str,
    detected: Vec<AppliedMatch<'_>>,
    flush_point: usize,
    start_cursor: usize,
    restoration: Option<&mut RestorationContext>,
    options: RenderOptions<'_>,
) -> Rendered<'t> {
    let placeholders = placeholder_spans(text);

    let detected_spans = detected.iter().map(|m| Span {
        start: m.detection.start,
        end: m.detection.end,
    });

    let safe_flush = hold_back_flush(
        flush_point,
        detected_spans.chain(placeholders.iter().copied()),
    );

    let matches = filter_matches(text, detected, options.allowlist, &placeholders);

    render_matches(
        text,
        matches,
        safe_flush,
        start_cursor,
        restoration,
        options,
    )
}

/// Detects with every rule, then renders. Mirrors `detectAndRender`.
pub fn detect_and_render<'t>(
    text: &'t str,
    rules: &[ActiveRule],
    flush_point: usize,
    start_cursor: usize,
    restoration: Option<&mut RestorationContext>,
    options: RenderOptions<'_>,
) -> Rendered<'t> {
    render_detected(
        text,
        detect_matches(text, rules),
        flush_point,
        start_cursor,
        restoration,
        options,
    )
}

/// Complete-string processing. Mirrors `processText`.
pub fn process_text(
    text: &str,
    rules: &[ActiveRule],
    restore: bool,
    options: RenderOptions<'_>,
) -> Inspection {
    let mut restoration = (restore && !options.detect_only).then(|| RestorationContext::new(false));

    let rendered = detect_and_render(text, rules, text.len(), 0, restoration.as_mut(), options);

    Inspection {
        text: rendered.segments.iter().map(|s| s.text.as_ref()).collect(),
        groups: rendered.groups,
        map: restoration.map(|context| context.map),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hold_back_repeats_until_no_span_crosses() {
        let spans = [Span { start: 10, end: 30 }, Span { start: 5, end: 15 }];

        assert_eq!(hold_back_flush(20, spans.iter().copied()), 5);
        assert_eq!(hold_back_flush(40, spans.iter().copied()), 40);
    }

    #[test]
    fn placeholders_are_found() {
        let spans = placeholder_spans("a [EMAIL] b [PHONE_2] [x]");

        assert_eq!(
            spans,
            [Span { start: 2, end: 9 }, Span { start: 12, end: 21 }]
        );
    }
}
