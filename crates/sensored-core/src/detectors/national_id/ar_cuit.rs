//! Argentine CUIT/CUIL. Mirrors `national-id/ar-cuit.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Argentina|CUIT|CUIL|Tax|Impuesto|Tributario)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ar_cuit",
        entity_type: "ar_cuit",
        replacement: "[AR_CUIT]",
        pattern: LazyLock::new(|| regex(r"[0-9]{2}-[0-9]{8}-[0-9]")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Argentina", "CUIT", "CUIL", "Tax", "Impuesto", "Tributario"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(13, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Argentina", "CUIT", "CUIL", "Tax", "Impuesto", "Tributario"] {
            assert_context_shape(&detector, label, "20-12345678-3");
        }
    }

    #[test]
    fn spans_and_reasons() {
        let detector = detector();

        assert_eq!(spans(&detector, "CUIT:        20-12345678-3"), [(13, 26)]);
        assert_eq!(spans(&detector, "CUIT: 20-12345678-3."), [(6, 19)]);
        assert_eq!(
            values(&detector, "CUIT: 20-12345678-3 and CUIT: 30-87654321-5"),
            ["20-12345678-3", "30-87654321-5"]
        );
        assert_eq!(
            detect(&detector, "CUIT: 20-12345678-3")[0].reasons,
            ["ar_cuit.format", "ar_cuit.context"]
        );
    }

    #[test]
    fn rejects_other_shapes() {
        let detector = detector();

        for text in [
            "CUIT: 20-12345678",
            "CUIT: 20-1234567-3",
            "CUIT: 20-123456789-3",
            "CUIT: 2-12345678-3",
            "CUIT: 200-12345678-3",
            "CUIT: 20-12345678-3x",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
