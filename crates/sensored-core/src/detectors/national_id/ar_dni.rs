//! Argentine DNI. Mirrors `national-id/ar-dni.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Argentina|Argentin|DNI|Documento Nacional|Identidad)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ar_dni",
        entity_type: "ar_dni",
        replacement: "[AR_DNI]",
        pattern: LazyLock::new(|| regex(r"[0-9]{7,8}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Argentina",
            "Argentin",
            "DNI",
            "Documento Nacional",
            "Identidad",
        ],
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

        for label in ["Argentina", "Argentin", "DNI", "Identidad"] {
            assert_context_shape(&detector, label, "12345678");
        }

        // `" (Documento Nacional)"` is wider than the right window.
        assert_eq!(
            values(&detector, "Documento Nacional: 12345678"),
            ["12345678"]
        );
        assert_eq!(values(&detector, "1234567 Documento Nacional"), ["1234567"]);
        assert!(values(&detector, "1234567 (Documento Nacional)").is_empty());
    }

    #[test]
    fn length_and_reasons() {
        let detector = detector();

        assert_eq!(values(&detector, "DNI: 1234567"), ["1234567"]);
        assert!(values(&detector, "DNI: 123456").is_empty());
        assert!(values(&detector, "DNI: 123456789").is_empty());
        assert_eq!(
            detect(&detector, "DNI: 12345678")[0].reasons,
            ["ar_dni.format", "ar_dni.context"]
        );
    }
}
