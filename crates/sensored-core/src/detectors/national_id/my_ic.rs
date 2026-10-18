//! Malaysia identity card (MyKad) number. Mirrors `national-id/my-ic.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::month_day_valid;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};
use crate::text::JS_SPACE_CLASS;

const LABELS: &str = "(?:Malaysia|Malaysian|MyKad|IC Number|Kad Pengenalan)";
const WINDOW: (usize, usize) = (35, 20);

/// JS `/\d{6}[-\s]?\d{2}[-\s]?\d{4}/g`.
fn pattern() -> Regex {
    let source = format!(
        r"[0-9]{{6}}[-{s}]?[0-9]{{2}}[-{s}]?[0-9]{{4}}",
        s = JS_SPACE_CLASS
    );

    Regex::new(&source).expect("valid pattern")
}

/// Mirrors `myIcValid`. The pattern leaves 12 digits once separators are
/// removed, and the date digits come before the first separator.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    month_day_valid(candidate).then_some(&["my_ic.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "my_ic",
        entity_type: "my_ic",
        replacement: "[MY_IC]",
        pattern: LazyLock::new(pattern),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Malaysia",
            "Malaysian",
            "MyKad",
            "IC Number",
            "Kad Pengenalan",
        ],
        window: WINDOW,
        validate: Some(validate),
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
            "MyKad",
            "Malaysia",
            "Malaysian",
            "IC Number",
            "Kad Pengenalan",
        ] {
            assert_context_shape(&detector, label, "900101-01-1234");
        }
    }

    #[test]
    fn separators() {
        let detector = detector();

        for value in [
            "900101-01-1234",
            "900101 01 1234",
            "900101011234",
            "900101-011234",
            "900101\u{3000}01\u{FEFF}1234",
            "900101\n01-1234",
        ] {
            let text = format!("MyKad: {value}");

            assert_eq!(values(&detector, &text), [value], "{text:?}");
        }

        for text in [
            "MyKad: 900101--01-1234",
            "MyKad: 900101\u{85}01-1234",
            "MyKad: 900101_01_1234",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }
    }

    #[test]
    fn month_and_day() {
        let detector = detector();

        assert_eq!(
            values(&detector, "MyKad: 901231-01-1234"),
            ["901231-01-1234"]
        );

        for text in [
            "MyKad: 901301-01-1234",
            "MyKad: 900001-01-1234",
            "MyKad: 900132-01-1234",
            "MyKad: 900100-01-1234",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn multiple_and_reasons() {
        let detector = detector();
        let text = "\u{1F600} MyKad: 900101-01-1234 and MyKad: 850615-14-5678";

        assert_eq!(spans(&detector, text), [(12, 26), (38, 52)]);
        assert_eq!(
            detect(&detector, text)[0].reasons,
            ["my_ic.format", "my_ic.context"]
        );
    }
}
