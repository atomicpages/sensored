//! Russian internal passport. Mirrors `national-id/ru-passport.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};
use crate::text::JS_SPACE_CLASS;

const LABELS: &str = "(?:Russia|Russian|Passport|Паспорт|Российский)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ru_passport",
        entity_type: "ru_passport",
        replacement: "[RU_PASSPORT]",
        // JS `/\d{4}\s?\d{6}/g`.
        pattern: LazyLock::new(|| regex(&format!(r"[0-9]{{4}}[{JS_SPACE_CLASS}]?[0-9]{{6}}"))),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Russia", "Russian", "Passport", "Паспорт", "Российский"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(11, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Russia", "Russian", "Passport", "Паспорт", "Российский"] {
            assert_context_shape(&detector, label, "1234 567890");
            assert_context_shape(&detector, label, "1234567890");
        }
    }

    #[test]
    fn separators_and_length() {
        let detector = detector();

        assert_eq!(
            values(&detector, "Passport: 1234\u{FEFF}567890"),
            ["1234\u{FEFF}567890"]
        );
        assert_eq!(
            values(&detector, "Passport: 1234\u{3000}567890"),
            ["1234\u{3000}567890"]
        );
        assert!(values(&detector, "Passport: 1234\u{85}567890").is_empty());
        assert_eq!(
            detect(&detector, "Паспорт: 1234 567890")[0].reasons,
            ["ru_passport.format", "ru_passport.context"]
        );

        for text in [
            "Passport: 1234 5678901",
            "Passport: 01234 567890",
            "Passport: 123456789",
            "Passport: 12345678901",
            "Passport: 123 567890",
            "Passport: 12345 67890",
            "Passport: 1234  567890",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
