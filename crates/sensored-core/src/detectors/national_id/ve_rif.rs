//! Venezuelan tax number (RIF). Mirrors `national-id/ve-rif.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Venezuela|RIF|Tax|SENIAT|Tributario)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ve_rif",
        entity_type: "ve_rif",
        replacement: "[VE_RIF]",
        // JS `/[VEJG]-\d{8,9}-\d/gi`: `i` without `u` folds ASCII only.
        pattern: LazyLock::new(|| regex(r"[VEJGvejg]-[0-9]{8,9}-[0-9]")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Venezuela", "RIF", "Tax", "SENIAT", "Tributario"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(13, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Venezuela", "RIF", "Tax", "SENIAT", "Tributario"] {
            assert_context_shape(&detector, label, "V-12345678-0");
        }
    }

    #[test]
    fn format_and_case() {
        let detector = detector();

        for value in [
            "V-12345678-0",
            "E-12345678-0",
            "J-123456789-0",
            "G-12345678-0",
            "j-12345678-0",
        ] {
            assert_eq!(values(&detector, &format!("RIF: {value}")), [value]);
        }

        assert_eq!(
            detect(&detector, "RIF: V-12345678-0")[0].reasons,
            ["ve_rif.format", "ve_rif.context"]
        );

        for text in [
            "RIF: X-12345678-0",
            "RIF: V12345678-0",
            "RIF: V-12345678",
            "RIF: V-1234567-0",
            "xRIF: V-12345678-0",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
