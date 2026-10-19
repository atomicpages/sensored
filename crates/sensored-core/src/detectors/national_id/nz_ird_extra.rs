//! New Zealand IRD number, label-only variant. Mirrors `national-id/nz-ird-extra.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:New Zealand|NZ|IRD|Tax|Inland Revenue)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "nz_ird_extra",
        entity_type: "nz_ird_extra",
        replacement: "[NZ_IRD_EXTRA]",
        pattern: LazyLock::new(|| regex(r"[0-9]{8,9}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["New Zealand", "NZ", "IRD", "Tax", "Inland Revenue"],
        window: WINDOW,
        validate: None,
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

        for label in ["IRD", "New Zealand", "NZ", "Tax", "Inland Revenue"] {
            assert_context_shape(&detector, label, "12345678");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        assert_eq!(values(&detector, "NZ Tax: 123456789"), ["123456789"]);
        assert_eq!(
            values(&detector, "Inland Revenue: 123456789"),
            ["123456789"]
        );

        for text in ["IRD: 1234567", "IRD: 1234567890"] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "IRD: 12345678")[0].reasons,
            ["nz_ird_extra.format", "nz_ird_extra.context"]
        );
        assert_eq!(spans(&detector, "IRD: \t 12345678"), [(7, 15)]);
    }
}
