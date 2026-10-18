//! New Zealand passport. Mirrors `national-id/nz-passport.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:New Zealand|NZ|Passport|Travel Document)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "nz_passport",
        entity_type: "nz_passport",
        replacement: "[NZ_PASSPORT]",
        // JS `/[A-Z]{2}\d{6}/gi`: `i` without `u` folds ASCII only.
        pattern: LazyLock::new(|| regex(r"[A-Za-z]{2}[0-9]{6}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["New Zealand", "NZ", "Passport", "Travel Document"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(8, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Passport", "New Zealand", "NZ", "Travel Document"] {
            assert_context_shape(&detector, label, "AB123456");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        assert_eq!(values(&detector, "passport: ab123456"), ["ab123456"]);

        for text in [
            "Passport: AB1234567",
            "Passport: 0AB123456",
            "Passport: AB12345",
            "Passport: A123456",
            "Passport: ABC123456",
            "Passport: \u{17F}B123456",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "Passport: AB123456")[0].reasons,
            ["nz_passport.format", "nz_passport.context"]
        );
        assert_eq!(spans(&detector, "(Passport: AB123456)"), [(11, 19)]);
    }
}
