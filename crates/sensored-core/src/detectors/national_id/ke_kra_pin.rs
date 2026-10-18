//! Kenya KRA PIN. Mirrors `national-id/ke-kra-pin.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:KRA|Kenya|Revenue|Authority|Tax|PIN|Taxpayer)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ke_kra_pin",
        entity_type: "ke_kra_pin",
        replacement: "[KE_KRA_PIN]",
        // No `i` flag: the letters are uppercase only.
        pattern: LazyLock::new(|| regex(r"A[0-9]{9}[A-Z]")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "KRA",
            "Kenya",
            "Revenue",
            "Authority",
            "Tax",
            "PIN",
            "Taxpayer",
        ],
        window: WINDOW,
        validate: None,
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

        for label in [
            "KRA",
            "Kenya",
            "Revenue",
            "Authority",
            "Tax",
            "PIN",
            "Taxpayer",
        ] {
            assert_context_shape(&detector, label, "A123456789B");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        for text in [
            "KRA: B123456789B",
            "KRA: A12345678B",
            "KRA: A1234567890B",
            "KRA: A123456789",
            "KRA: A123456789b",
            "KRA: a123456789B",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "KRA: A123456789B")[0].reasons,
            ["ke_kra_pin.format", "ke_kra_pin.context"]
        );
        assert_eq!(
            spans(&detector, "KRA: A123456789B and KRA: A987654321C"),
            [(5, 16), (26, 37)]
        );
    }
}
