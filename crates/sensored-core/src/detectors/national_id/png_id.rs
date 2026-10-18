//! Papua New Guinea national ID. Mirrors `national-id/png-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Papua New Guinea|Papua|New Guinea|National ID)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "png_id",
        entity_type: "png_id",
        replacement: "[PNG_ID]",
        // JS `/[A-Z0-9]{8,12}/gi`: `i` without `u` folds ASCII only.
        pattern: LazyLock::new(|| regex(r"[A-Za-z0-9]{8,12}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Papua New Guinea", "Papua", "New Guinea", "National ID"],
        window: WINDOW,
        validate: None,
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

        // "Papua New Guinea" is left out: its "New Guinea" suffix is a label
        // on its own, so the `my` prefix case still matches.
        for label in ["Papua", "New Guinea", "National ID"] {
            assert_context_shape(&detector, label, "ABCD1234");
        }

        assert_eq!(
            values(&detector, "Papua New Guinea: ABCD1234"),
            ["ABCD1234"]
        );
    }

    #[test]
    fn length_and_case() {
        let detector = detector();

        assert_eq!(values(&detector, "Papua: 123456789012"), ["123456789012"]);
        assert_eq!(values(&detector, "Papua: ABCD12345678"), ["ABCD12345678"]);
        assert_eq!(values(&detector, "papua: abcd1234"), ["abcd1234"]);
        assert!(values(&detector, "Papua: ABCD123").is_empty());
        assert!(values(&detector, "Papua: ABCD1234567890").is_empty());
    }

    #[test]
    fn multiple_and_reasons() {
        let detector = detector();
        let text = "Papua: ABCD1234 and Papua: WXYZ5678";

        assert_eq!(spans(&detector, text), [(7, 15), (27, 35)]);
        assert_eq!(
            detect(&detector, text)[0].reasons,
            ["png_id.format", "png_id.context"]
        );
    }
}
