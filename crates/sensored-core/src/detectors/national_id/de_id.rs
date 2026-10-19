//! German identity card number. Mirrors `national-id/de-id.ts`.
//!
//! The TS `validate` checks for 10 or 11 characters, which every match of
//! the pattern has, and returns the default reason; so there is none here.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Personalausweis|German ID|National ID|Identity Card|Ausweis)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "de_id",
        entity_type: "de_id",
        replacement: "[DE_ID]",
        // JS `/[A-Z0-9]{4}\d{7}|\d{10}/gi`: ASCII folding, leftmost-first.
        pattern: LazyLock::new(|| regex(r"[A-Za-z0-9]{4}[0-9]{7}|[0-9]{10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Personalausweis",
            "German ID",
            "National ID",
            "Identity Card",
            "Ausweis",
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
            "Personalausweis",
            "German ID",
            "National ID",
            "Identity Card",
            "Ausweis",
        ] {
            assert_context_shape(&detector, label, "L01X0064745");
        }
    }

    #[test]
    fn both_forms() {
        let detector = detector();

        assert_eq!(
            values(&detector, "German ID 1234567890 and German ID L01X0064745"),
            ["1234567890", "L01X0064745"]
        );
        assert_eq!(values(&detector, "Ausweis: l01x0064745"), ["l01x0064745"]);
        assert_eq!(values(&detector, "Ausweis: 12345678901"), ["12345678901"]);
        assert_eq!(spans(&detector, "Personalausweis: 1234567890"), [(17, 27)]);
        assert_eq!(
            detect(&detector, "Personalausweis: 1234567890")[0].reasons,
            ["de_id.format", "de_id.context"]
        );
    }

    #[test]
    fn rejects_other_lengths() {
        let detector = detector();

        for text in [
            "Personalausweis: 123456789",
            "Personalausweis: 123456789012",
            "Personalausweis: 12345678901234567890",
            "Personalausweis: L01X006474",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
