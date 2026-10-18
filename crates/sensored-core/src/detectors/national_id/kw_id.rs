//! Kuwait civil ID. Mirrors `national-id/kw-id.ts`.

use std::sync::LazyLock;

use super::{month_day_valid, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Kuwait|Civil ID|National ID)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `structurallyValid`: digits 3-4 are a month, 5-6 a day.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    month_day_valid(candidate).then_some(&["kw_id.structure"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "kw_id",
        entity_type: "kw_id",
        replacement: "[KW_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{12}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Kuwait", "Civil ID", "National ID"],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(12, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Kuwait", "Civil ID", "National ID"] {
            assert_context_shape(&detector, label, "281011500123");
        }
    }

    #[test]
    fn month_and_day() {
        let detector = detector();

        assert_eq!(
            values(&detector, "Civil ID: 281231500123"),
            ["281231500123"]
        );

        for text in [
            "Kuwait Civil ID: 280001500123",
            "Kuwait Civil ID: 281301500123",
            "Kuwait Civil ID: 281200500123",
            "Kuwait Civil ID: 281232500123",
            "Kuwait Civil ID: 28101150012",
            "Kuwait Civil ID: 2810115001234",
            "Kuwait Civil ID: 281011500123x",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn multiple_and_reasons() {
        let detector = detector();
        let text = "Kuwait Civil ID: 281011500123 and Kuwait Civil ID: 291012500456";

        assert_eq!(spans(&detector, text), [(17, 29), (51, 63)]);
        assert_eq!(
            detect(&detector, text)[0].reasons,
            ["kw_id.structure", "kw_id.context"]
        );
    }
}
