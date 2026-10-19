//! Italian codice fiscale. Mirrors `national-id/it-codice-fiscale.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Codice Fiscale|Fiscal Code|Tax Code|Italian ID)";
const WINDOW: (usize, usize) = (35, 20);

/// `oddValues` by index: `A`-`Z` are 0-25 and digit `d` shares the value of
/// the `d`-th letter. `evenValues` is the index itself.
const ODD_VALUES: [u32; 26] = [
    1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 10, 12, 14, 16, 22, 25, 24, 23,
];

/// Mirrors `codiceFiscaleValid`. The pattern guarantees 16 ASCII letters and
/// digits, so every character has a value.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let upper = candidate.as_bytes();

    let sum: u32 = upper[..15]
        .iter()
        .enumerate()
        .map(|(position, byte)| {
            let index = if byte.is_ascii_digit() {
                byte - b'0'
            } else {
                byte.to_ascii_uppercase() - b'A'
            };

            if position % 2 == 0 {
                ODD_VALUES[usize::from(index)]
            } else {
                u32::from(index)
            }
        })
        .sum();

    let expected = b'A' + u8::try_from(sum % 26).ok()?;

    (upper[15].to_ascii_uppercase() == expected).then_some(&["it_codice_fiscale.checksum"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "it_codice_fiscale",
        entity_type: "it_codice_fiscale",
        replacement: "[IT_CODICE_FISCALE]",
        // JS `/[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/gi`: ASCII folding only.
        pattern: LazyLock::new(|| {
            regex(r"[A-Za-z]{6}[0-9]{2}[A-Za-z][0-9]{2}[A-Za-z][0-9]{3}[A-Za-z]")
        }),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Codice Fiscale", "Fiscal Code", "Tax Code", "Italian ID"],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(16, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Codice Fiscale", "Fiscal Code", "Tax Code", "Italian ID"] {
            assert_context_shape(&detector, label, "RSSMRA85M01H501O");
        }
    }

    #[test]
    fn checksum() {
        let detector = detector();

        assert_eq!(
            values(
                &detector,
                "Codice Fiscale RSSMRA85M01H501O and Codice Fiscale BNCMRC80A01F205F"
            ),
            ["RSSMRA85M01H501O", "BNCMRC80A01F205F"]
        );
        assert_eq!(
            values(&detector, "Codice Fiscale: rssmra85m01h501o"),
            ["rssmra85m01h501o"]
        );

        for text in [
            "Codice Fiscale: RSSMRA85M01H501Z",
            "Codice Fiscale: RSSMRA85M01H50",
            "Codice Fiscale: RSSMRA85M01H501",
            "Codice Fiscale: RSSMRA85M01H501OO",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn spans_and_reasons() {
        let detector = detector();

        assert_eq!(
            spans(&detector, "Codice Fiscale: RSSMRA85M01H501O]"),
            [(16, 32)]
        );
        assert_eq!(
            detect(&detector, "Codice Fiscale: RSSMRA85M01H501O")[0].reasons,
            ["it_codice_fiscale.checksum", "it_codice_fiscale.context"]
        );
    }
}
