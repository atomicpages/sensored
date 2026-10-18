//! Oman civil ID. Mirrors `national-id/om-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Oman|Muscat|Civil ID|National ID)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "om_id",
        entity_type: "om_id",
        replacement: "[OM_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{8}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Oman", "Muscat", "Civil ID", "National ID"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(8, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Oman", "Muscat", "Civil ID", "National ID"] {
            assert_context_shape(&detector, label, "12345678");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        assert_eq!(
            values(&detector, "Muscat National ID: 87654321"),
            ["87654321"]
        );

        for text in [
            "Oman Civil ID: 1234567",
            "Oman Civil ID: 123456789",
            "Oman Civil ID: 12345678x",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "Oman: 12345678")[0].reasons,
            ["om_id.format", "om_id.context"]
        );
        assert_eq!(
            spans(
                &detector,
                "Oman Civil ID: 12345678 and Oman Civil ID: 87654321"
            ),
            [(15, 23), (43, 51)]
        );
    }
}
