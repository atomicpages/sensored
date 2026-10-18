//! Samoa national ID. Mirrors `national-id/ws-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Samoa|Samoan|National ID|Identity)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ws_id",
        entity_type: "ws_id",
        replacement: "[WS_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{8,10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Samoa", "Samoan", "National ID", "Identity"],
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

        for label in ["Samoa", "Samoan", "National ID", "Identity"] {
            assert_context_shape(&detector, label, "12345678");
        }
    }

    #[test]
    fn length() {
        let detector = detector();

        assert_eq!(values(&detector, "Samoa: 1234567890"), ["1234567890"]);
        assert_eq!(
            detect(&detector, "Samoa: 123456789")[0].reasons,
            ["ws_id.format", "ws_id.context"]
        );

        for text in ["Samoa: 1234567", "Samoa: 12345678901", "Samoa: ABCD1234"] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
