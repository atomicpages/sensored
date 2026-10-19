//! Colombian Cédula de Ciudadanía. Mirrors `national-id/co-cedula.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Colombia|Colombian|Cédula|Cedula|Ciudadanía|CC)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "co_cedula",
        entity_type: "co_cedula",
        replacement: "[CO_CEDULA]",
        pattern: LazyLock::new(|| regex(r"[0-9]{6,10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Colombia",
            "Colombian",
            "Cédula",
            "Cedula",
            "Ciudadanía",
            "CC",
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
            "Colombia",
            "Colombian",
            "Cédula",
            "Cedula",
            "Ciudadanía",
            "CC",
        ] {
            assert_context_shape(&detector, label, "1234567890");
        }
    }

    #[test]
    fn length_and_reasons() {
        let detector = detector();

        assert_eq!(values(&detector, "CC: 123456"), ["123456"]);
        assert_eq!(values(&detector, "CC: 1234567890"), ["1234567890"]);
        assert!(values(&detector, "CC: 12345").is_empty());
        assert!(values(&detector, "CC: 12345678901").is_empty());
        assert_eq!(
            detect(&detector, "CC: 1234567890")[0].reasons,
            ["co_cedula.format", "co_cedula.context"]
        );
    }
}
