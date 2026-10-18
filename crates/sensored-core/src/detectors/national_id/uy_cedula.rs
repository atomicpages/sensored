//! Uruguayan cédula. Mirrors `national-id/uy-cedula.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Uruguay|Uruguayan|Cédula|Cedula|Identidad)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "uy_cedula",
        entity_type: "uy_cedula",
        replacement: "[UY_CEDULA]",
        pattern: LazyLock::new(|| regex(r"[0-9]\.[0-9]{3}\.[0-9]{3}-[0-9]")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Uruguay", "Uruguayan", "Cédula", "Cedula", "Identidad"],
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

        for label in ["Uruguay", "Uruguayan", "Cédula", "Cedula", "Identidad"] {
            assert_context_shape(&detector, label, "1.234.567-8");
        }
    }

    #[test]
    fn format() {
        let detector = detector();

        assert_eq!(values(&detector, "Cédula: 1.234.567-8."), ["1.234.567-8"]);
        assert_eq!(
            detect(&detector, "Cédula: 1.234.567-8")[0].reasons,
            ["uy_cedula.format", "uy_cedula.context"]
        );

        for text in [
            "Cédula: 12.345.678-8",
            "Cédula: 1.234.5678",
            "Cédula: 1.234.56-8",
            "Cédula: 1,234,567-8",
            "xCédula: 1.234.567-8",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
