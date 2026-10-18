//! Peru Documento Nacional de Identidad. Mirrors `national-id/pe-dni.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Peru|Peruvian|Perú|Peruano|DNI|Documento Nacional|Identidad|RENIEC)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "pe_dni",
        entity_type: "pe_dni",
        replacement: "[PE_DNI]",
        pattern: LazyLock::new(|| regex(r"[0-9]{8}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Peru",
            "Peruvian",
            "Perú",
            "Peruano",
            "DNI",
            "Documento Nacional",
            "Identidad",
            "RENIEC",
        ],
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

        for label in [
            "DNI",
            "Peru",
            "Peruvian",
            "Perú",
            "Peruano",
            "Identidad",
            "RENIEC",
        ] {
            assert_context_shape(&detector, label, "12345678");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        assert_eq!(
            values(&detector, "Documento Nacional: 12345678"),
            ["12345678"]
        );
        assert_eq!(values(&detector, "PERÚ: 12345678"), ["12345678"]);

        for text in [
            "DNI: 1234567",
            "DNI: 123456789",
            "DNI: 12345678x",
            "xDNI: 12345678",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "DNI: 12345678")[0].reasons,
            ["pe_dni.format", "pe_dni.context"]
        );
        assert_eq!(spans(&detector, "Perú DNI: 12345678"), [(11, 19)]);
    }
}
