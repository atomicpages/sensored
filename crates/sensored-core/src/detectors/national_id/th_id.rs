//! Thai national ID. Mirrors `national-id/th-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Thailand|Thai|National ID|บัตร|ประชาชน)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `thIdValid`: weights 13 down to 2 over the first 12 digits, and
/// the check digit is `(11 - sum % 11) % 10`.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let bytes = candidate.as_bytes();

    if bytes.len() != 13 {
        return None;
    }

    let sum: u32 = bytes[..12]
        .iter()
        .zip((2..=13).rev())
        .map(|(digit, weight)| u32::from(digit - b'0') * weight)
        .sum();

    let check = (11 - sum % 11) % 10;

    if u32::from(bytes[12] - b'0') != check {
        return None;
    }

    Some(&["th_id.checksum"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "th_id",
        entity_type: "th_id",
        replacement: "[TH_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{13}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Thailand", "Thai", "National ID", "บัตร", "ประชาชน"],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(13, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    const VALID: &str = "1234567890121";

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Thailand", "Thai", "National ID", "บัตร", "ประชาชน"] {
            assert_context_shape(&detector, label, VALID);
        }
    }

    #[test]
    fn checksum() {
        let detector = detector();

        assert_eq!(
            detect(&detector, "National ID: 1234567890121")[0].reasons,
            ["th_id.checksum", "th_id.context"]
        );

        for text in [
            "National ID: 1234567890122",
            "National ID: 0000000000000",
            "National ID: 1111111111111",
            "National ID: 123456789012",
            "National ID: 12345678901210",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn offsets() {
        let detector = detector();

        assert_eq!(
            spans(
                &detector,
                "National ID: 1234567890121 and National ID: 1234567890121"
            ),
            [(13, 26), (44, 57)]
        );
        assert_eq!(
            spans(&detector, "😀 National ID: 1234567890121"),
            [(18, 31)]
        );
        assert!(values(&detector, "National ID: 1234567890121𝟙").is_empty());
    }
}
