//! Russian pension insurance number (SNILS). Mirrors `national-id/ru-snils.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};
use crate::text::JS_SPACE_CLASS;

const LABELS: &str = "(?:Russia|Russian|SNILS|СНИЛС|Pension|Пенсионный)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ru_snils",
        entity_type: "ru_snils",
        replacement: "[RU_SNILS]",
        // JS `/\d{3}-\d{3}-\d{3}\s?\d{2}/g`.
        pattern: LazyLock::new(|| {
            regex(&format!(
                r"[0-9]{{3}}-[0-9]{{3}}-[0-9]{{3}}[{JS_SPACE_CLASS}]?[0-9]{{2}}"
            ))
        }),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Russia",
            "Russian",
            "SNILS",
            "СНИЛС",
            "Pension",
            "Пенсионный",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(14, WINDOW.0, WINDOW.1),
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
            "Russia",
            "Russian",
            "SNILS",
            "СНИЛС",
            "Pension",
            "Пенсионный",
        ] {
            assert_context_shape(&detector, label, "123-456-789 00");
            assert_context_shape(&detector, label, "123-456-78900");
        }
    }

    #[test]
    fn separators_and_length() {
        let detector = detector();

        assert_eq!(
            values(&detector, "SNILS: 123-456-789\u{A0}00"),
            ["123-456-789\u{A0}00"]
        );
        assert_eq!(
            detect(&detector, "снилс: 123-456-789 00")[0].reasons,
            ["ru_snils.format", "ru_snils.context"]
        );

        for text in [
            "SNILS: 123-456-789 000",
            "SNILS: 0123-456-789 00",
            "SNILS: 123-45-789 00",
            "SNILS: 1234-567-89 00",
            "SNILS: 123-456-78 00",
            "SNILS: 123 456 789 00",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
