//! Nigeria Bank Verification Number. Mirrors `national-id/ng-bvn.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:BVN|Bank Verification|Nigeria|Nigerian|Banking)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ng_bvn",
        entity_type: "ng_bvn",
        replacement: "[NG_BVN]",
        pattern: LazyLock::new(|| regex(r"[0-9]{11}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["BVN", "Bank Verification", "Nigeria", "Nigerian", "Banking"],
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

        for label in ["BVN", "Bank Verification", "Nigeria", "Nigerian", "Banking"] {
            assert_context_shape(&detector, label, "12345678901");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        for text in [
            "BVN: 123456789010",
            "BVN: 012345678901",
            "BVN: 1234567890",
            "BVN: 123456789012",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "BVN: 12345678901")[0].reasons,
            ["ng_bvn.format", "ng_bvn.context"]
        );
        assert_eq!(
            spans(&detector, "BVN: 12345678901 and BVN: 98765432109"),
            [(5, 16), (26, 37)]
        );
    }
}
