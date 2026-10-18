//! Israeli Teudat Zehut. Mirrors `national-id/il-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Israel|Teudat|Zehut|Israeli|National ID)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "il_id",
        entity_type: "il_id",
        replacement: "[IL_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{9}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Israel", "Teudat", "Zehut", "Israeli", "National ID"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(9, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Israel", "Teudat", "Zehut", "Israeli", "National ID"] {
            assert_context_shape(&detector, label, "123456782");
        }

        assert_eq!(values(&detector, "Teudat Zehut: 123456782"), ["123456782"]);
    }

    #[test]
    fn length_and_reasons() {
        let detector = detector();

        assert!(values(&detector, "Zehut: 12345678").is_empty());
        assert!(values(&detector, "Zehut: 1234567890").is_empty());
        assert_eq!(
            detect(&detector, "Zehut: 123456782")[0].reasons,
            ["il_id.format", "il_id.context"]
        );
    }
}
