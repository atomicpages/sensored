//! Uzbekistan passport. Mirrors `national-id/uz-passport.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Uzbek|Uzbekistan|Passport|Pasport)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "uz_passport",
        entity_type: "uz_passport",
        replacement: "[UZ_PASSPORT]",
        // JS `/[A-Z]{2}\d{7}/g`: no `i`, so uppercase only.
        pattern: LazyLock::new(|| regex(r"[A-Z]{2}[0-9]{7}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Uzbek", "Uzbekistan", "Passport", "Pasport"],
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

        for label in ["Uzbek", "Uzbekistan", "Passport", "Pasport"] {
            assert_context_shape(&detector, label, "AB1234567");
        }
    }

    #[test]
    fn format_and_case() {
        let detector = detector();

        assert_eq!(
            detect(&detector, "Passport: AB1234567")[0].reasons,
            ["uz_passport.format", "uz_passport.context"]
        );

        for text in [
            "Passport: AB12345678",
            "Passport: A1234567",
            "Passport: xAB1234567",
            "passport: ab1234567",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
