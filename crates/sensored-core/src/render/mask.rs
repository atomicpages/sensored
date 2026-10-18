//! Mirrors `render/mask.ts`. TS offsets are UTF-16 units and these are bytes;
//! both index the same grapheme boundaries, so the output is identical.

use crate::grapheme;
use crate::types::{AppliedMatch, RuleSetting};

/// Preserves the first/last N graphemes of each mask match and hides the rest
/// with `*`. When the preserve counts reach the match length, the whole match
/// is hidden. Overlapping masks union their hidden regions.
pub(super) fn render(
    text: &str,
    matches: &[&AppliedMatch<'_>],
    start: usize,
    end: usize,
) -> String {
    let mut hidden: Vec<(usize, usize)> = matches
        .iter()
        .filter_map(|applied| hidden_region(text, applied))
        .collect();

    hidden.sort_by_key(|&(hidden_start, _)| hidden_start);

    let mut interval = 0;
    let mut result = String::with_capacity(end - start);

    for (index, cluster) in grapheme::segments(&text[start..end]) {
        let position = start + index;

        while interval < hidden.len() && hidden[interval].1 <= position {
            interval += 1;
        }

        let is_hidden = hidden
            .get(interval)
            .is_some_and(|&(hidden_start, _)| hidden_start <= position);

        if is_hidden {
            result.push('*');
        } else {
            result.push_str(cluster);
        }
    }

    result
}

/// The byte range a mask match hides, or `None` for a non-mask match.
fn hidden_region(text: &str, applied: &AppliedMatch<'_>) -> Option<(usize, usize)> {
    let RuleSetting::Mask { preserve } = &applied.rule.setting else {
        return None;
    };

    let detection = &applied.detection;
    let starts: Vec<usize> = grapheme::segments(&text[detection.start..detection.end])
        .map(|(index, _)| index)
        .collect();

    let count = |value: Option<u64>| usize::try_from(value.unwrap_or(0)).unwrap_or(usize::MAX);
    let first = count(preserve.as_ref().and_then(|p| p.first));
    let last = count(preserve.as_ref().and_then(|p| p.last));

    if first.saturating_add(last) >= starts.len() {
        return Some((detection.start, detection.end));
    }

    let hidden_start = detection.start + starts[first];

    let hidden_end = if last == 0 {
        detection.end
    } else {
        detection.start + starts[starts.len() - last]
    };

    Some((hidden_start, hidden_end))
}
