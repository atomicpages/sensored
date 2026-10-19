//! Fiji national ID. Mirrors `national-id/fj-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Fiji|Fijian|National ID|Identity)";
const WINDOW: (usize, usize) = (35, 20);

/// A letters-only word next to a label ("National ID: passport") is prose.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    candidate
        .bytes()
        .any(|byte| byte.is_ascii_digit())
        .then_some(&["fj_id.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "fj_id",
        entity_type: "fj_id",
        replacement: "[FJ_ID]",
        // JS `/[A-Z0-9]{8,10}/gi`: `i` without `u` folds ASCII only.
        pattern: LazyLock::new(|| regex(r"[A-Za-z0-9]{8,10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Fiji", "Fijian", "National ID", "Identity"],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(10, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Fiji", "Fijian", "National ID", "Identity"] {
            assert_context_shape(&detector, label, "ABCD1234");
        }
    }

    #[test]
    fn length_and_case() {
        let detector = detector();

        assert_eq!(values(&detector, "Fiji: 12345678"), ["12345678"]);
        assert_eq!(values(&detector, "Fiji: 1234567890"), ["1234567890"]);
        assert_eq!(values(&detector, "fiji: abcd1234"), ["abcd1234"]);
        assert!(values(&detector, "Fiji: ABCD123").is_empty());
        assert!(values(&detector, "Fiji: ABCD12345678").is_empty());
    }

    #[test]
    fn multiple_and_reasons() {
        let detector = detector();
        let text = "Fiji: ABCD1234 and Fiji: WXYZ5678";

        assert_eq!(spans(&detector, text), [(6, 14), (25, 33)]);
        assert_eq!(
            detect(&detector, text)[0].reasons,
            ["fj_id.format", "fj_id.context"]
        );
    }

    #[test]
    fn requires_a_digit() {
        let detector = detector();

        assert!(values(&detector, "National ID: passport").is_empty());
        assert!(values(&detector, "National ID: abcdefgh").is_empty());
    }
}
