//! French INSEE number (NIR). Mirrors `national-id/fr-insee.ts`.

use std::sync::LazyLock;

use super::{number, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:INSEE|NIR|Numéro de Sécurité Sociale|Social Security Number|Numéro INSEE)";
const WINDOW: (usize, usize) = (40, 20);

/// Mirrors `inseeValid`: the key is `97 - (first 13 digits mod 97)`. The
/// pattern guarantees 15 ASCII digits with at most one space before the key,
/// so the key is always the last two bytes.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let bytes = candidate.as_bytes();
    let (body, key) = (&bytes[..13], &bytes[bytes.len() - 2..]);

    (97 - number(body) % 97 == number(key)).then_some(&["fr_insee.checksum"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "fr_insee",
        entity_type: "fr_insee",
        replacement: "[FR_INSEE]",
        pattern: LazyLock::new(|| regex(r"[0-9]{13} ?[0-9]{2}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "INSEE",
            "NIR",
            "Numéro de Sécurité Sociale",
            "Social Security Number",
            "Numéro INSEE",
        ],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(15, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["INSEE", "NIR"] {
            assert_context_shape(&detector, label, "169027511610809");
        }

        // `INSEE` is a suffix of `Numéro INSEE`, and the long labels do not
        // fit the right window.
        for label in [
            "Numéro de Sécurité Sociale",
            "Social Security Number",
            "Numéro INSEE",
        ] {
            assert_eq!(
                values(&detector, &format!("{label}: 169027511610809")),
                ["169027511610809"]
            );
        }

        assert!(values(&detector, "169027511610809 (Social Security Number)").is_empty());
    }

    #[test]
    fn checksum() {
        let detector = detector();

        assert_eq!(
            values(
                &detector,
                "INSEE 169027511610809 and INSEE 2851234567892 96"
            ),
            ["169027511610809", "2851234567892 96"]
        );

        // 1000000000047 mod 97 is 0, so the key is 97, never 00.
        assert_eq!(
            values(&detector, "NIR: 100000000004797"),
            ["100000000004797"]
        );
        assert!(values(&detector, "NIR: 100000000004700").is_empty());

        // A one-digit key is written with a leading zero.
        assert_eq!(
            values(&detector, "NIR: 100000000003809"),
            ["100000000003809"]
        );

        for text in [
            "INSEE: 169027511610808",
            "INSEE: 1690275116108 08",
            "INSEE: 1690275116108",
            "INSEE: 1690275116108099",
            "INSEE: 1690275116108099123456789",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn spans_and_reasons() {
        let detector = detector();

        assert_eq!(spans(&detector, "INSEE: 169027511610809."), [(7, 22)]);
        assert_eq!(
            detect(&detector, "INSEE: 169027511610809")[0].reasons,
            ["fr_insee.checksum", "fr_insee.context"]
        );
    }
}
