//! API keys after an inline `api key` label. Mirrors `token/generic-api-key.ts`.
//!
//! TS: `/(?:api.{0,5}key|apikey|api.{0,5}token)[:\s=]+([a-zA-Z0-9_-]{20,})/gi`.
//! Without the `u` flag `.` is one UTF-16 unit, so the gap is built from
//! BMP chars (one unit) and astral chars (two), at most five units.

use std::sync::LazyLock;

use regex::Regex;

use super::{detection, js_space, regex};
use crate::detector::{
    ContextHint, Detector, HintPosition, HintWindow, Input, StreamMeta, is_adjacent_forbidden,
    push_aligned,
};
use crate::types::Detection;

const ID: &str = "generic_api_key";

const LABELS: &[&str] = &["API key", "apikey", "API token"];

const INSTRUCTIONS: &str = "Context is inline: the label (e.g. \"api_key\", \"apikey\", \"api token\") must immediately precede the key value, separated by a colon, whitespace, or equals sign.";

/// JS `.{0,5}` (greedy) without `u`.
const GAP_UNITS: usize = 5;

static PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    let gap = utf16_dot(GAP_UNITS);
    let space = js_space();

    regex(&format!(
        r"(?i-u:api{gap}key|apikey|api{gap}token)(?::|=|{space})+([a-zA-Z0-9_-]{{20,}})"
    ))
});

static EXCLUDED: LazyLock<Regex> =
    LazyLock::new(|| regex(r"(?i-u:example|sample|test|fake|demo|placeholder|xxx)"));

/// Greedy JS `.{0,units}` over UTF-16 units: each step takes one BMP char
/// (one unit) or one astral char (two). A text position allows only one of
/// the two, so trying the longer gap first matches JS backtracking.
fn utf16_dot(units: usize) -> String {
    const BMP: &str = r"(?u:[^\n\r\x{2028}\x{2029}\x{10000}-\x{10FFFF}])";
    const ASTRAL: &str = r"(?u:[\x{10000}-\x{10FFFF}])";

    match units {
        0 => String::new(),
        1 => format!("{BMP}?"),
        _ => format!(
            "(?:{BMP}{}|{ASTRAL}{})?",
            utf16_dot(units - 1),
            utf16_dot(units - 2)
        ),
    }
}

pub struct GenericApiKeyDetector;

impl Detector for GenericApiKeyDetector {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[GENERIC_API_KEY]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(256, 0, 0))
    }

    fn context_hint(&self) -> Option<ContextHint> {
        Some(ContextHint {
            required: true,
            labels: LABELS.iter().map(|label| (*label).to_owned()).collect(),
            position: HintPosition::Preceding,
            window: HintWindow {
                before: 0,
                after: 0,
            },
            instructions: Some(INSTRUCTIONS.to_owned()),
        })
    }

    fn detect_in(&self, input: &Input<'_>, out: &mut Vec<Detection>) {
        let text = input.text();

        let mut candidates = Vec::new();

        for captures in PATTERN.captures_iter(text) {
            // Separators are outside the value class, so TS's
            // `indexOf(value)` is the group's own start.
            let Some(value) = captures.get(1) else {
                continue;
            };

            if is_adjacent_forbidden(text, value.start(), value.end()) {
                continue;
            }

            if EXCLUDED.is_match(value.as_str()) {
                continue;
            }

            candidates.push(detection(
                ID,
                value.start(),
                value.end(),
                &["generic_api_key.context", "generic_api_key.format"],
            ));
        }

        push_aligned(text, candidates, out);
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    const KEY: &str = "abcdefghij1234567890abcd";

    #[test]
    fn finds_labelled_keys() {
        for label in [
            "api_key: ",
            "apikey=",
            "api.key: ",
            "api token: ",
            "api_token=",
            "API-Key:\t",
            "Config api_key: ",
        ] {
            let text = format!("{label}{KEY} done");

            assert_eq!(values(&GenericApiKeyDetector, &text), [KEY], "{text}");
        }
    }

    #[test]
    fn rejects_unlabelled_short_or_placeholder_values() {
        for text in [
            KEY.to_owned(),
            "api_key: abc123".to_owned(),
            "api_key: this_is_an_example_key_value".to_owned(),
            "api_key: FAKEFAKEFAKEFAKEFAKEFAKE".to_owned(),
            "api_key: xxxxxxxxxxxxxxxxxxxxxxxx".to_owned(),
            format!("api_key: {KEY}é"),
        ] {
            assert!(values(&GenericApiKeyDetector, &text).is_empty(), "{text}");
        }
    }

    #[test]
    fn gap_counts_utf16_units() {
        // Two astral chars are 4 units; three are 6, over the limit.
        let two = format!("api😀😀key: {KEY}");
        let three = format!("api😀😀😀key: {KEY}");

        assert_eq!(values(&GenericApiKeyDetector, &two), [KEY]);
        assert!(values(&GenericApiKeyDetector, &three).is_empty());
    }

    #[test]
    fn hint_is_inline() {
        let hint = GenericApiKeyDetector.context_hint().expect("hint");

        assert_eq!(hint.position, HintPosition::Preceding);
        assert_eq!(hint.labels, LABELS);
    }
}
