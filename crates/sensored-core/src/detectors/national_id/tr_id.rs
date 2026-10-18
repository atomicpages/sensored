//! Turkish identity number (TC Kimlik). Mirrors `national-id/tr-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Turkey|Turkish|TC|Kimlik|National ID)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "tr_id",
        entity_type: "tr_id",
        replacement: "[TR_ID]",
        pattern: LazyLock::new(|| regex(r"[1-9][0-9]{10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Turkey", "Turkish", "TC", "Kimlik", "National ID"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(11, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Turkey", "Turkish", "TC", "Kimlik", "National ID"] {
            assert_context_shape(&detector, label, "12345678901");
        }
    }

    #[test]
    fn leading_digit_and_length() {
        let detector = detector();

        assert_eq!(values(&detector, "TC Kimlik: 34567890123"), ["34567890123"]);
        assert_eq!(
            detect(&detector, "Turkey National ID: 12345678901")[0].reasons,
            ["tr_id.format", "tr_id.context"]
        );

        for text in [
            "Turkey National ID: 1234567890",
            "Turkey National ID: 123456789012",
            "Turkey National ID: 02345678901",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
