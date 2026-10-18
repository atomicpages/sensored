//! Tonga national ID. Mirrors `national-id/to-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Tonga|Tongan|National ID|Identity)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "to_id",
        entity_type: "to_id",
        replacement: "[TO_ID]",
        // JS `/[A-Z0-9]{8,10}/gi`: `i` without `u` folds ASCII only.
        pattern: LazyLock::new(|| regex(r"[A-Za-z0-9]{8,10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Tonga", "Tongan", "National ID", "Identity"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(10, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Tonga", "Tongan", "National ID", "Identity"] {
            assert_context_shape(&detector, label, "ABCD1234");
        }
    }

    #[test]
    fn length_and_case() {
        let detector = detector();

        assert_eq!(values(&detector, "Tonga: 12345678"), ["12345678"]);
        assert_eq!(values(&detector, "Tonga: 1234567890"), ["1234567890"]);
        assert_eq!(values(&detector, "tonga: abcd1234"), ["abcd1234"]);
        assert!(values(&detector, "Tonga: ABCD123").is_empty());
        assert!(values(&detector, "Tonga: ABCD12345678").is_empty());
    }

    #[test]
    fn multiple_and_reasons() {
        let detector = detector();
        let text = "Tonga: ABCD1234 and Tonga: WXYZ5678";

        assert_eq!(spans(&detector, text), [(7, 15), (27, 35)]);
        assert_eq!(
            detect(&detector, text)[0].reasons,
            ["to_id.format", "to_id.context"]
        );
    }
}
