//! Myanmar National Registration Card. Mirrors `national-id/mm-nrc.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Myanmar|Burmese|NRC|National Registration|Identity)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "mm_nrc",
        entity_type: "mm_nrc",
        replacement: "[MM_NRC]",
        // No `i` flag: the township is a capitalised ASCII word.
        pattern: LazyLock::new(|| regex(r"[0-9]{1,2}/[A-Z][a-z]+\([NC]\)[0-9]{6}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Myanmar",
            "Burmese",
            "NRC",
            "National Registration",
            "Identity",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(20, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["NRC", "Myanmar", "Burmese", "Identity"] {
            assert_context_shape(&detector, label, "12/Maung(N)123456");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        assert_eq!(
            values(&detector, "National Registration: 1/Yangon(C)654321"),
            ["1/Yangon(C)654321"]
        );
        assert_eq!(
            values(&detector, "NRC: 9/Mandalay(N)999999"),
            ["9/Mandalay(N)999999"]
        );

        for text in [
            "NRC: 12/maung(N)123456",
            "NRC: 12/MAUNG(N)123456",
            "NRC: 12/Maung(X)123456",
            "NRC: 12/Maung(n)123456",
            "NRC: 12/Maung(N)12345",
            "NRC: 12/Maung(N)1234567",
            "NRC: 12/Maung(N)123456\u{1D7D9}",
            "NRC: 123/Maung(N)123456",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "NRC: 12/Maung(N)123456")[0].reasons,
            ["mm_nrc.format", "mm_nrc.context"]
        );
        assert_eq!(
            spans(&detector, "\u{1F600} NRC: 12/Maung(N)123456"),
            [(10, 27)]
        );
    }
}
