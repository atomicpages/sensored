//! Lebanon national ID. Mirrors `national-id/lb-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Lebanon|Lebanese|Beirut|National ID)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "lb_id",
        entity_type: "lb_id",
        replacement: "[LB_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{7,8}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Lebanon", "Lebanese", "Beirut", "National ID"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(8, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Lebanon", "Lebanese", "Beirut", "National ID"] {
            assert_context_shape(&detector, label, "1234567");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        assert_eq!(
            values(&detector, "LEBANON NATIONAL ID: 12345678"),
            ["12345678"]
        );

        for text in [
            "Lebanon National ID: 123456",
            "Lebanon National ID: 123456789",
            "Lebanon National ID: 1234567x",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "Lebanon: 1234567")[0].reasons,
            ["lb_id.format", "lb_id.context"]
        );
        assert_eq!(
            spans(
                &detector,
                "Lebanon National ID: 1234567 and Lebanon National ID: 87654321"
            ),
            [(21, 28), (54, 62)]
        );
    }
}
