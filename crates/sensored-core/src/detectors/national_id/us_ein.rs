//! US Employer Identification Number. Mirrors `national-id/us-ein.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = r"(?:ein|employer[- ]?(?:id|identification)[- ]?(?:no\.?|number)?|tax[- ]?id)";
const WINDOW: (usize, usize) = (40, 40);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "us_ein",
        entity_type: "us_ein",
        replacement: "[US_EIN]",
        pattern: LazyLock::new(|| regex(r"[0-9]{2}[- ]?[0-9]{7}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "ein",
            "employer id",
            "employer id no.",
            "employer id no",
            "employer id number",
            "employer identification",
            "employer identification no.",
            "employer identification no",
            "employer identification number",
            "tax id",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(10, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in [
            "ein",
            "employer id",
            "employer id no.",
            "employer-id-number",
            "employer identification number",
            "tax id",
            "tax-id",
        ] {
            assert_context_shape(&detector, label, "12-3456789");
        }
    }

    #[test]
    fn separators() {
        let detector = detector();

        for value in ["01-2345678", "012345678", "01 2345678"] {
            assert_eq!(values(&detector, &format!("EIN: {value}")), [value]);
        }

        assert_eq!(
            detect(&detector, "EIN: 47-1234567")[0].reasons,
            ["us_ein.format", "us_ein.context"]
        );

        for text in [
            "EIN: 1-2345678",
            "EIN: 12-345678",
            "EIN: 12--3456789",
            "EIN: 12_3456789",
            "EIN: 12-34567890",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
