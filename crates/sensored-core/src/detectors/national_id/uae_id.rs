//! UAE Emirates ID. Mirrors `national-id/uae-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};
use crate::text::JS_SPACE_CLASS;

const LABELS: &str = "(?:UAE|Emirates|Dubai|Abu Dhabi|National ID|Emirates ID)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "uae_id",
        entity_type: "uae_id",
        replacement: "[UAE_ID]",
        // JS `/784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d|784\d{12}/g`.
        pattern: LazyLock::new(|| {
            regex(&format!(
                r"784[-{JS_SPACE_CLASS}]?[0-9]{{4}}[-{JS_SPACE_CLASS}]?[0-9]{{7}}[-{JS_SPACE_CLASS}]?[0-9]|784[0-9]{{12}}"
            ))
        }),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "UAE",
            "Emirates",
            "Dubai",
            "Abu Dhabi",
            "National ID",
            "Emirates ID",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(18, WINDOW.0, WINDOW.1),
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
            "UAE",
            "Emirates",
            "Dubai",
            "Abu Dhabi",
            "National ID",
            "Emirates ID",
        ] {
            assert_context_shape(&detector, label, "784-1234-5678901-2");
            assert_context_shape(&detector, label, "784123456789012");
        }
    }

    #[test]
    fn separators_and_length() {
        let detector = detector();

        for value in [
            "784 1234 5678901 2",
            "784-1234 5678901\u{FEFF}2",
            "7841234-56789012",
        ] {
            assert_eq!(values(&detector, &format!("Dubai: {value}")), [value]);
        }

        assert_eq!(
            detect(&detector, "Emirates ID: 784-1234-5678901-2")[0].reasons,
            ["uae_id.format", "uae_id.context"]
        );

        for text in [
            "Emirates ID: 784-1234-5678901-23",
            "Emirates ID: 0784-1234-5678901-2",
            "Emirates ID: 784-1234-5678901-",
            "Emirates ID: 78412345678901",
            "Emirates ID: 7841234567890123",
            "Emirates ID: 785-1234-5678901-2",
            "Emirates ID: 784--1234-5678901-2",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
