//! Ghana Card PIN. Mirrors `national-id/gh-card.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Ghana|Ghanaian|Ghana Card|National ID|Identity)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "gh_card",
        entity_type: "gh_card",
        replacement: "[GH_CARD]",
        // No `i` flag: the prefix is uppercase only.
        pattern: LazyLock::new(|| regex(r"GHA-[0-9]{9}-[0-9]")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Ghana", "Ghanaian", "Ghana Card", "National ID", "Identity"],
        window: WINDOW,
        validate: None,
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

        for label in ["Ghana", "Ghanaian", "Ghana Card", "National ID", "Identity"] {
            assert_context_shape(&detector, label, "GHA-123456789-1");
        }
    }

    #[test]
    fn shape() {
        let detector = detector();

        for text in [
            "Ghana Card: GHA-12345678-1",
            "Ghana Card: GHA-1234567890-1",
            "Ghana Card: GHA-123456789",
            "Ghana Card: gha-123456789-1",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }

        assert_eq!(
            values(
                &detector,
                "Ghana Card: GHA-123456789-1 and Ghana Card: GHA-987654321-0"
            ),
            ["GHA-123456789-1", "GHA-987654321-0"]
        );
    }

    #[test]
    fn spans_and_reasons() {
        let detector = detector();

        assert_eq!(
            spans(&detector, "GHA-123456789-1        (Ghana Card)"),
            [(0, 15)]
        );
        assert_eq!(
            detect(&detector, "Ghana Card: GHA-123456789-1")[0].reasons,
            ["gh_card.format", "gh_card.context"]
        );
    }
}
