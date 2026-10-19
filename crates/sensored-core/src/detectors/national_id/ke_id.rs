//! Kenya national ID. Mirrors `national-id/ke-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Kenya|Kenyan|National ID|Identity)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ke_id",
        entity_type: "ke_id",
        replacement: "[KE_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{7,8}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Kenya", "Kenyan", "National ID", "Identity"],
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

        for label in ["National ID", "Identity", "Kenya", "Kenyan"] {
            assert_context_shape(&detector, label, "1234567");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        assert_eq!(values(&detector, "National ID: 12345678"), ["12345678"]);
        assert_eq!(
            values(&detector, "National ID:        1234567"),
            ["1234567"]
        );

        for text in [
            "National ID: 123456",
            "National ID: 123456789",
            "1234567x (National ID)",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "National ID: 1234567")[0].reasons,
            ["ke_id.format", "ke_id.context"]
        );
        assert_eq!(
            spans(&detector, "National ID: 1234567 and National ID: 8765432"),
            [(13, 20), (38, 45)]
        );
    }
}
