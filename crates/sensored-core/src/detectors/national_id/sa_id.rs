//! Saudi national ID and Iqama. Mirrors `national-id/sa-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Saudi|KSA|Kingdom|Iqama|National ID|Muqeem)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "sa_id",
        entity_type: "sa_id",
        replacement: "[SA_ID]",
        pattern: LazyLock::new(|| regex(r"[12][0-9]{9}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Saudi", "KSA", "Kingdom", "Iqama", "National ID", "Muqeem"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(10, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Saudi", "KSA", "Kingdom", "Iqama", "National ID", "Muqeem"] {
            assert_context_shape(&detector, label, "1234567890");
        }
    }

    #[test]
    fn leading_digit_and_length() {
        let detector = detector();

        assert_eq!(values(&detector, "Iqama: 2345678901"), ["2345678901"]);
        assert_eq!(
            detect(&detector, "Saudi National ID: 1234567890")[0].reasons,
            ["sa_id.format", "sa_id.context"]
        );

        for text in [
            "Saudi National ID: 12345678901",
            "Saudi National ID: 123456789",
            "Saudi National ID: 3234567890",
            "Saudi National ID: 0234567890",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
