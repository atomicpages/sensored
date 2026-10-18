//! Jordanian national number. Mirrors `national-id/jo-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Jordan|Amman|National ID|Jordanian)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "jo_id",
        entity_type: "jo_id",
        replacement: "[JO_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Jordan", "Amman", "National ID", "Jordanian"],
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

        for label in ["Jordan", "Amman", "National ID", "Jordanian"] {
            assert_context_shape(&detector, label, "9861234567");
        }
    }

    #[test]
    fn length_and_reasons() {
        let detector = detector();

        assert!(values(&detector, "Jordan: 986123456").is_empty());
        assert!(values(&detector, "Jordan: 98612345678").is_empty());
        assert_eq!(
            values(&detector, "Jordan: 9861234567 and Jordan: 2000123456"),
            ["9861234567", "2000123456"]
        );
        assert_eq!(
            detect(&detector, "Jordan: 9861234567")[0].reasons,
            ["jo_id.format", "jo_id.context"]
        );
    }
}
