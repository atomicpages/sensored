//! Peru taxpayer number (RUC). Mirrors `national-id/pe-ruc.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Peru|Perú|RUC|Tax|SUNAT|Tributario)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `rucValid`: the taxpayer-type prefix.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let prefix = candidate.get(..2)?;

    ["10", "15", "17", "20"]
        .contains(&prefix)
        .then_some(&["pe_ruc.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "pe_ruc",
        entity_type: "pe_ruc",
        replacement: "[PE_RUC]",
        pattern: LazyLock::new(|| regex(r"[0-9]{11}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Peru", "Perú", "RUC", "Tax", "SUNAT", "Tributario"],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(11, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["RUC", "Peru", "Perú", "Tax", "SUNAT", "Tributario"] {
            assert_context_shape(&detector, label, "20123456789");
        }
    }

    #[test]
    fn prefix() {
        let detector = detector();

        for value in ["10123456789", "15123456789", "17123456789", "20123456789"] {
            let text = format!("RUC: {value}");

            assert_eq!(values(&detector, &text), [value], "{text}");
        }

        for text in [
            "RUC: 12345678901",
            "RUC: 30123456789",
            "RUC: 05123456789",
            "RUC: 1234567890",
            "RUC: 201234567890",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn multiple_and_reasons() {
        let detector = detector();
        let text = "PERÚ RUC: 20123456789 and SUNAT: 10123456789";

        assert_eq!(spans(&detector, text), [(11, 22), (34, 45)]);
        assert_eq!(
            detect(&detector, text)[0].reasons,
            ["pe_ruc.format", "pe_ruc.context"]
        );
    }
}
