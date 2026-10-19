//! Tajikistan national ID. Mirrors `national-id/tj-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Tajik|Tajikistan|National ID|Identity)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "tj_id",
        entity_type: "tj_id",
        replacement: "[TJ_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{9,10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Tajik", "Tajikistan", "National ID", "Identity"],
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

        for label in ["Tajik", "Tajikistan", "National ID", "Identity"] {
            assert_context_shape(&detector, label, "123456789");
            assert_context_shape(&detector, label, "1234567890");
        }
    }

    #[test]
    fn length() {
        let detector = detector();

        assert_eq!(
            detect(&detector, "National ID: 123456789")[0].reasons,
            ["tj_id.format", "tj_id.context"]
        );
        assert!(values(&detector, "National ID: 12345678").is_empty());
        assert!(values(&detector, "National ID: 12345678901").is_empty());
    }
}
