//! Colombian NIT. Mirrors `national-id/co-nit.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Colombia|NIT|Tax|Impuesto|Tributario|Empresa)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "co_nit",
        entity_type: "co_nit",
        replacement: "[CO_NIT]",
        pattern: LazyLock::new(|| regex(r"[0-9]{9}-[0-9]")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Colombia",
            "NIT",
            "Tax",
            "Impuesto",
            "Tributario",
            "Empresa",
        ],
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

        for label in [
            "Colombia",
            "NIT",
            "Tax",
            "Impuesto",
            "Tributario",
            "Empresa",
        ] {
            assert_context_shape(&detector, label, "900123456-7");
        }
    }

    #[test]
    fn shape_and_reasons() {
        let detector = detector();

        for text in ["NIT: 900123456", "NIT: 90012345-7", "NIT: 9001234567-7"] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }

        assert_eq!(
            values(&detector, "NIT: 900123456-7 and NIT: 800987654-3"),
            ["900123456-7", "800987654-3"]
        );
        assert_eq!(
            detect(&detector, "NIT: 900123456-7")[0].reasons,
            ["co_nit.format", "co_nit.context"]
        );
    }
}
