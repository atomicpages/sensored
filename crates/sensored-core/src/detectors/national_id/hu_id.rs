//! Hungarian personal ID card number. Mirrors `national-id/hu-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Hungarian|Magyar|Személyi|Igazolvány|Personal ID)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "hu_id",
        entity_type: "hu_id",
        replacement: "[HU_ID]",
        // No `i` flag: the letters are uppercase only.
        pattern: LazyLock::new(|| regex(r"[0-9]{6}[A-Z]{2}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Hungarian",
            "Magyar",
            "Személyi",
            "Igazolvány",
            "Personal ID",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(8, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in [
            "Hungarian",
            "Magyar",
            "Személyi",
            "Igazolvány",
            "Personal ID",
        ] {
            assert_context_shape(&detector, label, "123456AB");
        }
    }

    #[test]
    fn shape_and_reasons() {
        let detector = detector();

        for text in [
            "Személyi: 123456ab",
            "Személyi: 12345AB",
            "Személyi: 1234567AB",
            "Személyi: 123456ABC",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }

        assert_eq!(
            detect(&detector, "Személyi: 123456AB")[0].reasons,
            ["hu_id.format", "hu_id.context"]
        );
    }
}
