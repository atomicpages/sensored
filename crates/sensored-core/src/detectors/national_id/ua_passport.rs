//! Ukrainian passport. Mirrors `national-id/ua-passport.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Ukrainian|Passport|Паспорт|Український)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ua_passport",
        entity_type: "ua_passport",
        replacement: "[UA_PASSPORT]",
        // JS `/[A-Z]{2}\d{6}/g`: no `i`, so uppercase only.
        pattern: LazyLock::new(|| regex(r"[A-Z]{2}[0-9]{6}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Ukrainian", "Passport", "Паспорт", "Український"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(8, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Ukrainian", "Passport", "Паспорт", "Український"] {
            assert_context_shape(&detector, label, "AB123456");
        }
    }

    #[test]
    fn format_and_case() {
        let detector = detector();

        assert_eq!(
            values(&detector, "Український Паспорт: EF789012"),
            ["EF789012"]
        );
        assert_eq!(
            detect(&detector, "Passport: AB123456")[0].reasons,
            ["ua_passport.format", "ua_passport.context"]
        );

        for text in [
            "Passport: AB1234567",
            "Passport: 0AB123456",
            "Passport: A123456",
            "Passport: ABC123456",
            "Passport: AB12345",
            "Passport: ab123456",
            "Паспорт: МК123456",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
