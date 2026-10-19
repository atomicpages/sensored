//! The detector contract and the generic, table-driven detectors.
//! Mirrors `detectors/base.ts` and `detectors/checksum-detector.ts`.
//!
//! Porting rules for regexes: JS `\d`, `\w` and `\b` are ASCII even with the
//! `u` flag, but Unicode in the `regex` crate. Port them as `[0-9]`,
//! `[A-Za-z0-9_]` and `(?-u:\b)`. JS `\s` also matches U+FEFF; Rust does not.

use std::cell::OnceCell;
use std::collections::HashSet;
use std::sync::{LazyLock, Mutex, PoisonError};

use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::grapheme;
use crate::text::{window_after, window_before};
use crate::types::{Detection, Label};

/// How much text a detector needs around a match to decide it, so a stream
/// knows what it may flush. All values are UTF-16 code units, as in TS.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamMeta {
    pub max_match_length: usize,
    pub left_context: usize,
    pub right_context: usize,
    pub boundary_lookaround: usize,
}

impl StreamMeta {
    /// Mirrors `streamMeta()`: boundary lookaround is 1.
    pub const fn new(max_match_length: usize, left_context: usize, right_context: usize) -> Self {
        Self {
            max_match_length,
            left_context,
            right_context,
            boundary_lookaround: 1,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HintPosition {
    Preceding,
    Following,
    Both,
}

/// Mirrors `ContextHint`. Window sizes are UTF-16 code units.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContextHint {
    pub required: bool,
    pub labels: Vec<String>,
    pub position: HintPosition,
    pub window: HintWindow,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instructions: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct HintWindow {
    pub before: usize,
    pub after: usize,
}

/// Mirrors `DetectorDescription`: what `listDetectors()` and `describe()`
/// report.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectorDescription {
    pub id: String,
    pub entity_type: String,
    pub replacement: String,
    pub stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_hint: Option<ContextHint>,
}

impl DetectorDescription {
    pub fn of(detector: &dyn Detector) -> Self {
        Self {
            id: detector.id().to_owned(),
            entity_type: detector.entity_type().to_owned(),
            replacement: detector.replacement().to_owned(),
            stream: detector.stream().is_some(),
            context_hint: detector.context_hint(),
        }
    }
}

pub trait Detector: Send + Sync {
    fn id(&self) -> &str;
    fn entity_type(&self) -> &str;
    fn replacement(&self) -> &str;

    /// `None` means the detector cannot run in a stream.
    fn stream(&self) -> Option<StreamMeta>;

    fn context_hint(&self) -> Option<ContextHint> {
        None
    }

    /// Appends this detector's matches in `input` to `out`, with byte offsets.
    fn detect_in(&self, input: &Input<'_>, out: &mut Vec<Detection>);

    /// `detect_in` on `text` alone, for callers running one detector.
    fn detect(&self, text: &str, out: &mut Vec<Detection>) {
        self.detect_in(&Input::new(text), out);
    }
}

/// The text one call redacts, shared by every detector it runs. Derived views
/// are computed once, on first use.
pub struct Input<'t> {
    text: &'t str,
    ascii_lower: OnceCell<Option<String>>,
}

impl<'t> Input<'t> {
    pub fn new(text: &'t str) -> Self {
        Self {
            text,
            ascii_lower: OnceCell::new(),
        }
    }

    pub fn text(&self) -> &'t str {
        self.text
    }

    /// The text with ASCII letters lowercased (same byte offsets), so a
    /// case-sensitive lowercase pattern matches it exactly as `(?i)` matches
    /// the text. `None` when the text has K (U+212A) or ſ (U+017F): Unicode
    /// case folding maps them to ASCII letters, ASCII lowercasing doesn't.
    pub fn ascii_lower(&self) -> Option<&str> {
        self.ascii_lower
            .get_or_init(|| {
                (!self.text.contains(['\u{212A}', '\u{17F}']))
                    .then(|| self.text.to_ascii_lowercase())
            })
            .as_deref()
    }
}

// ---------------------------------------------------------------------------
// Shared checks (the protected helpers on the TS `Detector` base class)
// ---------------------------------------------------------------------------

fn is_forbidden_adjacent(ch: char) -> bool {
    static FORBIDDEN: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"^[\p{L}\p{M}\p{N}_]$").expect("valid pattern"));

    if ch.is_ascii() {
        return ch.is_ascii_alphanumeric() || ch == '_';
    }

    let mut buffer = [0; 4];

    FORBIDDEN.is_match(ch.encode_utf8(&mut buffer))
}

/// True when the character before `start` is a letter, mark, number or `_`.
pub fn is_start_forbidden(text: &str, start: usize) -> bool {
    text[..start]
        .chars()
        .next_back()
        .is_some_and(is_forbidden_adjacent)
}

/// True when the character at `end` is a letter, mark, number or `_`.
pub fn is_end_forbidden(text: &str, end: usize) -> bool {
    text[end..]
        .chars()
        .next()
        .is_some_and(is_forbidden_adjacent)
}

/// True when the match is embedded in a larger word. Mirrors `isAdjacentForbidden`.
pub fn is_adjacent_forbidden(text: &str, start: usize, end: usize) -> bool {
    is_start_forbidden(text, start) || is_end_forbidden(text, end)
}

/// Appends the candidates whose endpoints are grapheme-aligned. Mirrors
/// `filterGraphemeAligned`.
pub fn push_aligned(text: &str, candidates: Vec<Detection>, out: &mut Vec<Detection>) {
    out.extend(candidates.into_iter().filter(|candidate| {
        grapheme::is_boundary(text, candidate.start) && grapheme::is_boundary(text, candidate.end)
    }));
}

fn reasons(list: &[&'static str]) -> Vec<Label> {
    list.iter().map(|&reason| reason.into()).collect()
}

/// `label` as a `&'static str`, leaked once per distinct value, for reasons
/// derived from a built-in id (`<id>.format`). Built-ins are finite, so the
/// set is bounded; callers intern once per `detect_in`, not per match.
fn intern(label: String) -> &'static str {
    static LABELS: LazyLock<Mutex<HashSet<&'static str>>> = LazyLock::new(Mutex::default);

    let mut labels = LABELS.lock().unwrap_or_else(PoisonError::into_inner);

    if let Some(&known) = labels.get(label.as_str()) {
        return known;
    }

    let leaked: &'static str = Box::leak(label.into_boxed_str());
    labels.insert(leaked);

    leaked
}

/// `[<id>.<a>, <id>.<b>]`, interned on first use in one `detect_in` call.
fn derived_reasons<'c>(
    cell: &'c OnceCell<[&'static str; 2]>,
    id: &str,
    [a, b]: [&str; 2],
) -> &'c [&'static str; 2] {
    cell.get_or_init(|| [intern(format!("{id}.{a}")), intern(format!("{id}.{b}"))])
}

// ---------------------------------------------------------------------------
// Context matching (`createContextMatcher`)
// ---------------------------------------------------------------------------

/// Label checks either side of a match. `labels` is the raw alternation the
/// TS detector passes as `contextLabels`, inserted verbatim as TS does.
///
/// For many candidates in one text, use [`ContextMatcher::scan`]: it finds
/// label occurrences once and skips the exact checks where none is near.
pub struct ContextMatcher {
    /// The labels alone, for the pre-check in [`ContextScan`].
    label: Regex,
    /// `label` for [`Input::ascii_lower`]: lowercase literals, case-sensitive,
    /// so the regex keeps its literal prefilter. `None` when a class holds a
    /// cased non-ASCII letter (see `lowercase_literals`).
    lower_label: Option<Regex>,
    preceding: Regex,
    following: Regex,
    following_no_paren: Regex,
    left: usize,
    right: usize,
}

impl ContextMatcher {
    /// # Panics
    /// If `labels` does not compile; labels are static detector data.
    pub fn new(labels: &str, left: usize, right: usize) -> Self {
        // `ContextScan` relies on a label match in a window also being a match
        // in the full text, which anchors and word boundaries would break.
        debug_assert!(
            !labels.contains(['^', '$']) && !labels.contains(r"\b") && !labels.contains("(?<"),
            "context labels must not use anchors, word boundaries or lookbehind"
        );

        let compile = |pattern: String| Regex::new(&pattern).expect("valid context pattern");

        Self {
            label: compile(format!("(?i){labels}")),
            lower_label: lowercase_literals(labels).map(compile),
            preceding: compile(format!(
                r"(?i)(?:^|[^\p{{L}}\p{{M}}\p{{N}}_]){labels}[ \t]{{0,8}}[:#]?[ \t]{{0,8}}$"
            )),
            following: compile(format!(r"(?i)^[ \t]{{1,8}}\({labels}\)")),
            following_no_paren: compile(format!(
                r"(?i)^[ \t]{{1,8}}{labels}(?:[^\p{{L}}\p{{M}}\p{{N}}_]|$)"
            )),
            left,
            right,
        }
    }

    pub fn has_preceding(&self, text: &str, start: usize) -> bool {
        self.preceding
            .is_match(window_before(text, start, self.left))
    }

    pub fn has_following(&self, text: &str, end: usize) -> bool {
        let after = window_after(text, end, self.right);

        self.following.is_match(after) || self.following_no_paren.is_match(after)
    }

    pub fn has_context(&self, text: &str, start: usize, end: usize) -> bool {
        self.has_preceding(text, start) || self.has_following(text, end)
    }

    /// Context checks over many candidates in `input`, with a label pre-check.
    pub fn scan<'m, 'i, 't>(&'m self, input: &'i Input<'t>) -> ContextScan<'m, 'i, 't> {
        ContextScan {
            matcher: self,
            input,
            labels: OnceCell::new(),
        }
    }
}

/// `pattern` with its literal ASCII letters lowercased, for case-sensitive
/// matching on ASCII-lowercased text. Escapes keep their letters (`\S`,
/// `\p{Lu}`). A cased non-ASCII letter, which ASCII lowercasing leaves as is,
/// becomes `(?i:c)`: its own Unicode case folding, as under `(?i)`. `None`
/// when one sits inside a class, where a group cannot go.
fn lowercase_literals(pattern: &str) -> Option<String> {
    let mut out = String::with_capacity(pattern.len());
    let mut chars = pattern.chars();
    let mut in_class = false;

    while let Some(ch) = chars.next() {
        if ch == '\\' {
            out.push(ch);

            let escaped = chars.next()?;
            out.push(escaped);

            // `\p{...}`, `\x{...}`: copy the braces verbatim.
            if matches!(escaped, 'p' | 'P' | 'x' | 'u') && chars.as_str().starts_with('{') {
                for inner in chars.by_ref() {
                    out.push(inner);

                    if inner == '}' {
                        break;
                    }
                }
            }

            continue;
        }

        match ch {
            '[' => in_class = true,
            ']' => in_class = false,
            _ => {}
        }

        if !ch.is_ascii() && (ch.is_lowercase() || ch.is_uppercase()) {
            if in_class {
                return None;
            }

            out.push_str("(?i:");
            out.push(ch);
            out.push(')');
            continue;
        }

        out.push(ch.to_ascii_lowercase());
    }

    Some(out)
}

/// A UTF-16 unit takes at most 3 UTF-8 bytes, so `n` units span at most
/// `3n` bytes: a byte bound that contains every UTF-16 window.
const MAX_BYTES_PER_UTF16_UNIT: usize = 3;

/// [`ContextMatcher`] checks for one text. Label occurrences are found once,
/// on first use; the exact window regexes run only when an occurrence
/// overlaps the window. Results are identical to the matcher's own methods:
/// a label inside a window is a label in the text (labels have no anchors),
/// and leftmost-first matching reports every label position inside some
/// reported occurrence.
pub struct ContextScan<'m, 'i, 't> {
    matcher: &'m ContextMatcher,
    input: &'i Input<'t>,
    labels: OnceCell<Vec<(usize, usize)>>,
}

impl ContextScan<'_, '_, '_> {
    pub fn has_preceding(&self, start: usize) -> bool {
        self.label_before(start) && self.matcher.has_preceding(self.input.text(), start)
    }

    pub fn has_following(&self, end: usize) -> bool {
        self.label_after(end) && self.matcher.has_following(self.input.text(), end)
    }

    pub fn has_context(&self, start: usize, end: usize) -> bool {
        self.has_preceding(start) || self.has_following(end)
    }

    /// Whether the text has any label at all. When it has none, no
    /// candidate can have context, so a detector may skip its pattern scan.
    pub fn any_label(&self) -> bool {
        !self.labels().is_empty()
    }

    /// Whether a label occurrence overlaps the left window of `start`.
    pub fn label_before(&self, start: usize) -> bool {
        let reach = MAX_BYTES_PER_UTF16_UNIT * self.matcher.left;

        self.label_overlaps(start.saturating_sub(reach), start)
    }

    /// Whether a label occurrence overlaps the right window of `end`.
    pub fn label_after(&self, end: usize) -> bool {
        let reach = MAX_BYTES_PER_UTF16_UNIT * self.matcher.right;

        self.label_overlaps(end, end.saturating_add(reach))
    }

    /// Occurrences are sorted and disjoint, so the first one ending after
    /// `lo` is the only candidate.
    fn label_overlaps(&self, lo: usize, hi: usize) -> bool {
        let labels = self.labels();
        let first = labels.partition_point(|&(_, end)| end <= lo);

        labels.get(first).is_some_and(|&(start, _)| start < hi)
    }

    fn labels(&self) -> &[(usize, usize)] {
        self.labels.get_or_init(|| {
            // Same leftmost-first occurrences either way; see `ascii_lower`.
            let found = match (&self.matcher.lower_label, self.input.ascii_lower()) {
                (Some(lower_label), Some(lower)) => lower_label.find_iter(lower),
                _ => self.matcher.label.find_iter(self.input.text()),
            };

            found.map(|found| (found.start(), found.end())).collect()
        })
    }
}

/// `None` rejects the candidate; `Some(reasons)` accepts it.
pub type Validate = fn(&str) -> Option<&'static [&'static str]>;

// ---------------------------------------------------------------------------
// ContextDetector
// ---------------------------------------------------------------------------

/// Pattern, adjacency check, optional validate, then a required context label
/// nearby. Mirrors the TS `ContextDetector`.
///
/// Detectors are built by a function and registered as `Arc`s:
///
/// ```ignore
/// pub(super) fn detector() -> ContextDetector {
///     ContextDetector {
///         id: "rs_jmbg",
///         entity_type: "rs_jmbg",
///         replacement: "[RS_JMBG]",
///         pattern: LazyLock::new(|| Regex::new(r"[0-9]{13}").expect("valid pattern")),
///         context: LazyLock::new(|| ContextMatcher::new(RS_JMBG_LABELS, 35, 20)),
///         labels: &["JMBG", "Serbian"],
///         window: (35, 20),
///         validate: Some(rs_jmbg_valid),
///         stream: StreamMeta::new(13, 35, 20),
///     }
/// }
///
/// registry.insert(Arc::new(rs_jmbg::detector()));
/// ```
pub struct ContextDetector {
    pub id: &'static str,
    pub entity_type: &'static str,
    pub replacement: &'static str,
    pub pattern: LazyLock<Regex>,
    pub context: LazyLock<ContextMatcher>,
    /// Human-readable labels for the context hint (`labelStrings`).
    pub labels: &'static [&'static str],
    /// `(leftContext, rightContext)` in UTF-16 units.
    pub window: (usize, usize),
    /// Defaults to `["<id>.format"]` when `None`.
    pub validate: Option<Validate>,
    pub stream: StreamMeta,
}

impl Detector for ContextDetector {
    fn id(&self) -> &str {
        self.id
    }

    fn entity_type(&self) -> &str {
        self.entity_type
    }

    fn replacement(&self) -> &str {
        self.replacement
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(self.stream)
    }

    fn context_hint(&self) -> Option<ContextHint> {
        Some(ContextHint {
            required: true,
            labels: self.labels.iter().map(|&label| label.to_owned()).collect(),
            position: HintPosition::Both,
            window: HintWindow {
                before: self.window.0,
                after: self.window.1,
            },
            instructions: None,
        })
    }

    fn detect_in(&self, input: &Input<'_>, out: &mut Vec<Detection>) {
        let text = input.text();

        let context = self.context.scan(input);

        if !context.any_label() {
            return;
        }

        let mut candidates = Vec::new();
        let derived = OnceCell::new();

        for found in self.pattern.find_iter(text) {
            let (start, end) = (found.start(), found.end());

            if is_adjacent_forbidden(text, start, end) {
                continue;
            }

            // `None` means no validator; reasons are built only for survivors.
            let validated = match self.validate {
                Some(validate) => match validate(found.as_str()) {
                    Some(list) => Some(list),
                    None => continue,
                },
                None => None,
            };

            if !context.has_context(start, end) {
                continue;
            }

            let [format, context] = *derived_reasons(&derived, self.id, ["format", "context"]);
            let mut accepted = validated.map_or_else(|| vec![format.into()], reasons);

            accepted.push(context.into());

            candidates.push(Detection {
                start,
                end,
                rule_id: self.id.into(),
                entity_type: self.entity_type.into(),
                reasons: accepted,
            });
        }

        push_aligned(text, candidates, out);
    }
}

// ---------------------------------------------------------------------------
// ChecksumDetector
// ---------------------------------------------------------------------------

/// Pattern, adjacency check, then a validate hook that supplies all reasons.
/// Mirrors the TS `ChecksumDetector`.
pub struct ChecksumDetector {
    pub id: &'static str,
    pub entity_type: &'static str,
    pub replacement: &'static str,
    pub pattern: LazyLock<Regex>,
    pub validate: Validate,
    pub stream: StreamMeta,
}

impl Detector for ChecksumDetector {
    fn id(&self) -> &str {
        self.id
    }

    fn entity_type(&self) -> &str {
        self.entity_type
    }

    fn replacement(&self) -> &str {
        self.replacement
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(self.stream)
    }

    fn detect_in(&self, input: &Input<'_>, out: &mut Vec<Detection>) {
        let text = input.text();

        let mut candidates = Vec::new();

        for found in self.pattern.find_iter(text) {
            let (start, end) = (found.start(), found.end());

            if is_adjacent_forbidden(text, start, end) {
                continue;
            }

            let Some(list) = (self.validate)(found.as_str()) else {
                continue;
            };

            candidates.push(Detection {
                start,
                end,
                rule_id: self.id.into(),
                entity_type: self.entity_type.into(),
                reasons: reasons(list),
            });
        }

        push_aligned(text, candidates, out);
    }
}

// ---------------------------------------------------------------------------
// KeywordDetector
// ---------------------------------------------------------------------------

/// Pattern, adjacency check, then a keyword within `KEYWORD_WINDOW` UTF-16
/// units either side. Mirrors the TS `KeywordDetector`.
pub struct KeywordDetector {
    pub id: &'static str,
    pub entity_type: &'static str,
    pub replacement: &'static str,
    pub pattern: LazyLock<Regex>,
    /// Lowercase; compared with the lowercased window.
    pub keywords: &'static [&'static str],
    pub stream: StreamMeta,
}

pub const KEYWORD_WINDOW: usize = 40;

impl Detector for KeywordDetector {
    fn id(&self) -> &str {
        self.id
    }

    fn entity_type(&self) -> &str {
        self.entity_type
    }

    fn replacement(&self) -> &str {
        self.replacement
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(self.stream)
    }

    fn detect_in(&self, input: &Input<'_>, out: &mut Vec<Detection>) {
        debug_assert!(self.keywords.iter().all(|k| *k == k.to_lowercase()));

        let text = input.text();

        let mut candidates = Vec::new();
        let derived = OnceCell::new();

        for found in self.pattern.find_iter(text) {
            let (start, end) = (found.start(), found.end());

            if is_adjacent_forbidden(text, start, end) {
                continue;
            }

            // Joined before matching, as in TS, so a keyword may straddle the match.
            let window = format!(
                "{}{}",
                window_before(text, start, KEYWORD_WINDOW),
                window_after(text, end, KEYWORD_WINDOW)
            )
            .to_lowercase();

            let has_keyword = self.keywords.iter().any(|keyword| window.contains(keyword));

            if !has_keyword {
                continue;
            }

            candidates.push(Detection {
                start,
                end,
                rule_id: self.id.into(),
                entity_type: self.entity_type.into(),
                reasons: derived_reasons(&derived, self.id, ["format", "keyword"])
                    .iter()
                    .map(|&reason| reason.into())
                    .collect(),
            });
        }

        push_aligned(text, candidates, out);
    }
}

// ---------------------------------------------------------------------------
// ExternalDetector
// ---------------------------------------------------------------------------

/// A detector that runs outside the core (a user's JS `DetectorDefinition`).
/// The core knows its metadata for policy and rendering; its matches arrive
/// through the collect/render seam, so `detect` finds nothing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExternalDetector {
    pub id: String,
    pub entity_type: String,
    pub replacement: String,
    pub stream: Option<StreamMeta>,
    pub context_hint: Option<ContextHint>,
}

impl Detector for ExternalDetector {
    fn id(&self) -> &str {
        &self.id
    }

    fn entity_type(&self) -> &str {
        &self.entity_type
    }

    fn replacement(&self) -> &str {
        &self.replacement
    }

    fn stream(&self) -> Option<StreamMeta> {
        self.stream
    }

    fn context_hint(&self) -> Option<ContextHint> {
        self.context_hint.clone()
    }

    fn detect_in(&self, _input: &Input<'_>, _out: &mut Vec<Detection>) {}
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lowercase_literals_keeps_escapes_and_folds_non_ascii_letters() {
        assert_eq!(
            lowercase_literals(r"(?:SSN|Driver['’]s No\.|\S\p{Lu}\x{41})").as_deref(),
            Some(r"(?:ssn|driver['’]s no\.|\S\p{Lu}\x{41})")
        );
        assert_eq!(
            lowercase_literals("Паспорт").as_deref(),
            Some("(?i:П)(?i:а)(?i:с)(?i:п)(?i:о)(?i:р)(?i:т)")
        );
        assert_eq!(lowercase_literals("N[ºÉ]"), None);
    }

    /// The fast label path finds exactly what `(?i)` finds.
    #[test]
    fn label_scan_matches_unicode_case_folding() {
        let matcher = ContextMatcher::new("(?:Passport|Паспорт|Cédula|SK)", 10, 10);
        let unicode = Regex::new("(?i)(?:Passport|Паспорт|Cédula|SK)").expect("pattern");

        for text in [
            "PASSPORT pASSport passport",
            "ПАСПОРТ паспорт CÉDULA cédula",
            "\u{212A}ilo s\u{212A} \u{17F}k",
            "plain text with no labels",
        ] {
            let input = Input::new(text);
            let scan = matcher.scan(&input);
            let expected: Vec<(usize, usize)> = unicode
                .find_iter(text)
                .map(|m| (m.start(), m.end()))
                .collect();

            assert_eq!(scan.labels(), expected, "{text:?}");
        }
    }

    #[test]
    fn ascii_lower_skips_texts_with_folding_non_ascii() {
        assert_eq!(Input::new("AbC é").ascii_lower(), Some("abc é"));
        assert_eq!(Input::new("\u{212A}").ascii_lower(), None);
        assert_eq!(Input::new("\u{17F}").ascii_lower(), None);
    }

    static SAMPLE: ContextDetector = ContextDetector {
        id: "sample_id",
        entity_type: "sample_id",
        replacement: "[SAMPLE_ID]",
        pattern: LazyLock::new(|| Regex::new(r"[0-9]{6}").expect("valid pattern")),
        context: LazyLock::new(|| ContextMatcher::new("(?:Sample ID|SID)", 20, 10)),
        labels: &["Sample ID", "SID"],
        window: (20, 10),
        validate: None,
        stream: StreamMeta::new(6, 20, 10),
    };

    fn detect(detector: &dyn Detector, text: &str) -> Vec<(usize, usize)> {
        let mut out = Vec::new();
        detector.detect(text, &mut out);

        out.iter().map(|d| (d.start, d.end)).collect()
    }

    #[test]
    fn context_detector_needs_a_label() {
        assert_eq!(detect(&SAMPLE, "Sample ID: 123456"), [(11, 17)]);
        assert_eq!(detect(&SAMPLE, "123456 (SID)"), [(0, 6)]);
        assert!(detect(&SAMPLE, "order 123456").is_empty());
        assert!(detect(&SAMPLE, "SID: x123456").is_empty());
    }

    #[test]
    fn context_detector_reasons() {
        let mut out = Vec::new();
        SAMPLE.detect("sid 123456", &mut out);

        assert_eq!(out[0].reasons, ["sample_id.format", "sample_id.context"]);
    }

    #[test]
    fn adjacency_is_unicode_aware() {
        assert!(is_adjacent_forbidden("é1", 2, 3));
        assert!(!is_adjacent_forbidden("-1-", 1, 2));
        assert!(is_end_forbidden("1\u{301}", 1));
    }
}
