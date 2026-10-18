//! Venezuelan cédula. Mirrors `national-id/ve-cedula.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Venezuela|Venezuelan|Cédula|Cedula|Identidad|CI)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ve_cedula",
        entity_type: "ve_cedula",
        replacement: "[VE_CEDULA]",
        // JS `/[VE]-\d{1,8}/gi`: `i` without `u` folds ASCII only.
        pattern: LazyLock::new(|| regex(r"[VEve]-[0-9]{1,8}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Venezuela",
            "Venezuelan",
            "Cédula",
            "Cedula",
            "Identidad",
            "CI",
        ],
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

        for label in [
            "Venezuela",
            "Venezuelan",
            "Cédula",
            "Cedula",
            "Identidad",
            "CI",
        ] {
            assert_context_shape(&detector, label, "V-12345678");
        }
    }

    #[test]
    fn format_and_case() {
        let detector = detector();

        for value in ["V-12345678", "E-12345678", "v-12345678", "V-1"] {
            assert_eq!(values(&detector, &format!("Cédula: {value}")), [value]);
        }

        assert_eq!(
            detect(&detector, "CI: V-12345678")[0].reasons,
            ["ve_cedula.format", "ve_cedula.context"]
        );

        for text in [
            "Cédula: X-12345678",
            "Cédula: V12345678",
            "Cédula: V-123456789",
            "xCédula: V-12345678",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
