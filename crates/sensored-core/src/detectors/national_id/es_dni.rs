//! Spanish DNI. Mirrors `national-id/es-dni.ts`.

use std::sync::LazyLock;

use super::{number, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:DNI|Documento Nacional de Identidad|Spanish ID|National ID)";
const WINDOW: (usize, usize) = (40, 20);

const DNI_LETTERS: &[u8; 23] = b"TRWAGMYFPDXBNJZSQVHLCKE";

/// Mirrors `dniValid`: the letter is the number mod 23 in `DNI_LETTERS`,
/// in either case. The pattern guarantees eight ASCII digits and a letter.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let bytes = candidate.as_bytes();
    let index = usize::try_from(number(&bytes[..8]) % 23).ok()?;
    let letter = bytes[8].to_ascii_uppercase();

    (DNI_LETTERS[index] == letter).then_some(&["es_dni.checksum"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "es_dni",
        entity_type: "es_dni",
        replacement: "[ES_DNI]",
        // JS `/\d{8}[A-Z]/gi`: ASCII folding only.
        pattern: LazyLock::new(|| regex(r"[0-9]{8}[A-Za-z]")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "DNI",
            "Documento Nacional de Identidad",
            "Spanish ID",
            "National ID",
        ],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(9, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["DNI", "Spanish ID", "National ID"] {
            assert_context_shape(&detector, label, "12345678Z");
        }

        // The long label only fits the left window.
        assert_eq!(
            values(&detector, "Documento Nacional de Identidad: 12345678Z"),
            ["12345678Z"]
        );
    }

    #[test]
    fn checksum() {
        let detector = detector();

        for value in [
            "12345678Z",
            "00000001R",
            "23456789D",
            "87654321X",
            "12345678z",
        ] {
            assert_eq!(values(&detector, &format!("DNI: {value}")), [value]);
        }

        for value in ["12345678A", "1234567Z", "123456789Z"] {
            assert!(
                values(&detector, &format!("DNI: {value}")).is_empty(),
                "{value}"
            );
        }
    }

    #[test]
    fn spans_and_reasons() {
        let detector = detector();

        assert_eq!(
            values(&detector, "DNI 12345678Z and DNI 23456789D"),
            ["12345678Z", "23456789D"]
        );
        assert_eq!(spans(&detector, "DNI: 12345678Z]"), [(5, 14)]);
        assert_eq!(
            detect(&detector, "DNI: 12345678Z")[0].reasons,
            ["es_dni.checksum", "es_dni.context"]
        );
    }
}
