//! Philippines Unified Multi-Purpose ID. Mirrors `national-id/ph-umid.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};
use crate::text::JS_SPACE_CLASS;

const LABELS: &str = "(?:Philippines|Filipino|UMID|Unified|Multipurpose|National ID)";
const WINDOW: (usize, usize) = (35, 20);

fn pattern() -> Regex {
    let source = format!(
        r"[0-9]{{4}}[-{s}]?[0-9]{{7}}[-{s}]?[0-9]",
        s = JS_SPACE_CLASS
    );

    Regex::new(&source).expect("valid pattern")
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ph_umid",
        entity_type: "ph_umid",
        replacement: "[PH_UMID]",
        // JS `[-\s]` is `-` or a JS space.
        pattern: LazyLock::new(pattern),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Philippines",
            "Filipino",
            "UMID",
            "Unified",
            "Multipurpose",
            "National ID",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(14, WINDOW.0, WINDOW.1),
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
            "UMID",
            "Philippines",
            "Filipino",
            "Unified",
            "Multipurpose",
            "National ID",
        ] {
            assert_context_shape(&detector, label, "1234-5678901-2");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        assert_eq!(
            values(&detector, "UMID: 1234 5678901 2"),
            ["1234 5678901 2"]
        );
        assert_eq!(values(&detector, "UMID: 123456789012"), ["123456789012"]);
        assert_eq!(
            values(&detector, "UMID: 1234\u{3000}5678901\u{FEFF}2"),
            ["1234\u{3000}5678901\u{FEFF}2"]
        );
        assert_eq!(
            values(&detector, "UMID: 1234\n5678901-2"),
            ["1234\n5678901-2"]
        );

        for text in [
            "UMID: 1234--5678901-2",
            "UMID: 1234-567890-2",
            "UMID: 1234-5678901-23",
            "UMID: 1234_5678901_2",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "UMID: 1234-5678901-2")[0].reasons,
            ["ph_umid.format", "ph_umid.context"]
        );
        assert_eq!(
            spans(&detector, "UMID: 1234\u{85}5678901-2 UMID: 1234-5678901-2"),
            [(28, 42)]
        );
    }
}
