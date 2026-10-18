//! Qatar ID. Mirrors `national-id/qa-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Qatar|QID|Doha|National ID|Resident Permit)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "qa_id",
        entity_type: "qa_id",
        replacement: "[QA_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{11}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Qatar", "QID", "Doha", "National ID", "Resident Permit"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(11, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Qatar", "QID", "Doha", "National ID", "Resident Permit"] {
            assert_context_shape(&detector, label, "12345678901");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        assert_eq!(
            values(&detector, "Doha National ID: 23456789012"),
            ["23456789012"]
        );

        for text in [
            "Qatar QID: 1234567890",
            "Qatar QID: 123456789012",
            "Qatar QID: 12345678901x",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "Qatar: 12345678901")[0].reasons,
            ["qa_id.format", "qa_id.context"]
        );
        assert_eq!(
            spans(
                &detector,
                "Qatar QID: 12345678901 and Qatar QID: 23456789012"
            ),
            [(11, 22), (38, 49)]
        );
    }
}
