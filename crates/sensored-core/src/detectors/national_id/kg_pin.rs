//! Kyrgyzstan personal identification number. Mirrors `national-id/kg-pin.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Kyrgyz|Kyrgyzstan|PIN|Personal ID|Личный|Номер)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "kg_pin",
        entity_type: "kg_pin",
        replacement: "[KG_PIN]",
        pattern: LazyLock::new(|| regex(r"[0-9]{14}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Kyrgyz",
            "Kyrgyzstan",
            "PIN",
            "Personal ID",
            "Личный",
            "Номер",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(14, WINDOW.0, WINDOW.1),
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
            "PIN",
            "Kyrgyz",
            "Kyrgyzstan",
            "Personal ID",
            "Личный",
            "Номер",
        ] {
            assert_context_shape(&detector, label, "12345678901234");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        assert_eq!(
            values(&detector, "ЛИЧНЫЙ: 12345678901234"),
            ["12345678901234"]
        );

        for text in ["PIN: 123456789012345", "PIN: 1234567890123"] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "PIN: 12345678901234")[0].reasons,
            ["kg_pin.format", "kg_pin.context"]
        );
        assert_eq!(
            spans(&detector, "Личный: 12345678901234 and PIN: 98765432109876"),
            [(14, 28), (38, 52)]
        );
    }
}
