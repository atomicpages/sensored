//! Turkmenistan passport. Mirrors `national-id/tm-passport.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Turkmen|Turkmenistan|Passport|Pasport)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "tm_passport",
        entity_type: "tm_passport",
        replacement: "[TM_PASSPORT]",
        // JS `/[A-Z]\d{7}/g`: no `i`, so uppercase only.
        pattern: LazyLock::new(|| regex(r"[A-Z][0-9]{7}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Turkmen", "Turkmenistan", "Passport", "Pasport"],
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

        for label in ["Turkmen", "Turkmenistan", "Passport", "Pasport"] {
            assert_context_shape(&detector, label, "A1234567");
        }
    }

    #[test]
    fn format_and_case() {
        let detector = detector();

        assert_eq!(
            detect(&detector, "Passport: A1234567")[0].reasons,
            ["tm_passport.format", "tm_passport.context"]
        );

        for text in [
            "Passport: AB1234567",
            "Passport: 1234567",
            "Passport: A12345678",
            "Passport: xA1234567",
            "passport: a1234567",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
