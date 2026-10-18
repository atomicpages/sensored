//! Nigeria National Identification Number. Mirrors `national-id/ng-nin.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Nigeria|NIN|National ID|Identity|Nigerian)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ng_nin",
        entity_type: "ng_nin",
        replacement: "[NG_NIN]",
        pattern: LazyLock::new(|| regex(r"[0-9]{11}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Nigeria", "NIN", "National ID", "Identity", "Nigerian"],
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

        for label in ["NIN", "Nigeria", "National ID", "Identity", "Nigerian"] {
            assert_context_shape(&detector, label, "12345678901");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        for text in [
            "NIN: 123456789010",
            "NIN: 012345678901",
            "NIN: 1234567890",
            "NIN: 123456789012",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "NIN: 12345678901")[0].reasons,
            ["ng_nin.format", "ng_nin.context"]
        );
        assert_eq!(
            spans(&detector, "NIN: 12345678901 and NIN: 98765432109"),
            [(5, 16), (26, 37)]
        );
    }
}
