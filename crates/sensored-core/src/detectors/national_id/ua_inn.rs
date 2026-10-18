//! Ukrainian taxpayer number (INN). Mirrors `national-id/ua-inn.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Ukrainian|INN|Tax|Податковий|ІНН)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ua_inn",
        entity_type: "ua_inn",
        replacement: "[UA_INN]",
        pattern: LazyLock::new(|| regex(r"[0-9]{10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Ukrainian", "INN", "Tax", "Податковий", "ІНН"],
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

        for label in ["Ukrainian", "INN", "Tax", "Податковий", "ІНН"] {
            assert_context_shape(&detector, label, "1234567890");
        }
    }

    #[test]
    fn length() {
        let detector = detector();

        assert_eq!(values(&detector, "інн: 1234567890"), ["1234567890"]);
        assert_eq!(
            detect(&detector, "INN: 1234567890")[0].reasons,
            ["ua_inn.format", "ua_inn.context"]
        );

        for text in ["INN: 12345678901", "INN: 01234567890", "INN: 123456789"] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
