//! Uzbekistan STIR (tax ID). Mirrors `national-id/uz-stir.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Uzbek|Uzbekistan|STIR|Tax|INN|Soliq)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "uz_stir",
        entity_type: "uz_stir",
        replacement: "[UZ_STIR]",
        pattern: LazyLock::new(|| regex(r"[0-9]{9}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Uzbek", "Uzbekistan", "STIR", "Tax", "INN", "Soliq"],
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

        for label in ["Uzbek", "Uzbekistan", "STIR", "Tax", "INN", "Soliq"] {
            assert_context_shape(&detector, label, "123456789");
        }

        assert_eq!(values(&detector, "Uzbek STIR: 123456789"), ["123456789"]);
    }

    #[test]
    fn length() {
        let detector = detector();

        assert!(values(&detector, "STIR: 1234567890").is_empty());
        assert!(values(&detector, "STIR: 12345678").is_empty());
        assert!(values(&detector, "STIR: 0123456789").is_empty());
        assert!(values(&detector, "123456789x (STIR)").is_empty());
    }

    #[test]
    fn multiple_and_reasons() {
        let detector = detector();
        let text = "STIR: 123456789 and STIR: 987654321";

        assert_eq!(values(&detector, text), ["123456789", "987654321"]);
        assert_eq!(
            detect(&detector, text)[0].reasons,
            ["uz_stir.format", "uz_stir.context"]
        );
    }
}
