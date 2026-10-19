//! Morocco CNIE. Mirrors `national-id/ma-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Morocco|Moroccan|CNIE|National ID|Identity)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ma_id",
        entity_type: "ma_id",
        replacement: "[MA_ID]",
        // No `i` flag in TS: the letters are uppercase only.
        pattern: LazyLock::new(|| regex(r"[A-Z]{1,2}[0-9]{6,8}|[0-9]{8}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Morocco", "Moroccan", "CNIE", "National ID", "Identity"],
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

        for label in ["Morocco", "Moroccan", "CNIE", "National ID", "Identity"] {
            assert_context_shape(&detector, label, "AB123456");
        }

        assert_eq!(values(&detector, "AB123456        (CNIE)"), ["AB123456"]);
        assert_eq!(
            values(&detector, "National ID:        AB123456"),
            ["AB123456"]
        );
    }

    #[test]
    fn shapes() {
        let detector = detector();

        for value in ["A1234567", "12345678", "AB12345678", "A12345678"] {
            let text = format!("National ID: {value}");

            assert_eq!(values(&detector, &text), [value]);
        }

        assert!(values(&detector, "National ID: ab123456").is_empty());
        assert!(values(&detector, "National ID: AB12345_").is_empty());
        assert!(values(&detector, "National ID: ABC123456").is_empty());
        assert!(values(&detector, "National ID: 1234567").is_empty());
        assert!(values(&detector, "AB123456x (National ID)").is_empty());
    }

    #[test]
    fn multiple_and_reasons() {
        let detector = detector();
        let text = "National ID: AB123456 and National ID: CD789012";

        assert_eq!(spans(&detector, text), [(13, 21), (39, 47)]);
        assert_eq!(
            detect(&detector, text)[0].reasons,
            ["ma_id.format", "ma_id.context"]
        );
    }
}
