//! US Individual Taxpayer Identification Number. Mirrors `national-id/us-itin.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str =
    r"(?:itin|individual[- ]?taxpayer[- ]?(?:id|identification)[- ]?(?:no\.?|number)?|tax[- ]?id)";
const WINDOW: (usize, usize) = (40, 40);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "us_itin",
        entity_type: "us_itin",
        replacement: "[US_ITIN]",
        pattern: LazyLock::new(|| regex(r"9[0-9]{2}[- ]?(?:7[0-9]|8[0-8])[- ]?[0-9]{4}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "itin",
            "individual taxpayer id",
            "individual taxpayer id no.",
            "individual taxpayer id no",
            "individual taxpayer id number",
            "individual taxpayer identification",
            "individual taxpayer identification no.",
            "individual taxpayer identification no",
            "individual taxpayer identification number",
            "tax id",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(11, WINDOW.0, WINDOW.1),
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
            "itin",
            "individual taxpayer id",
            "individual taxpayer id no.",
            "individual-taxpayer-identification",
            "tax id",
        ] {
            assert_context_shape(&detector, label, "970-70-1234");
        }
    }

    #[test]
    fn group_ranges() {
        let detector = detector();

        for value in [
            "970-70-1234",
            "980-88-5678",
            "999-88-9999",
            "970701234",
            "980 88 5678",
        ] {
            assert_eq!(values(&detector, &format!("ITIN: {value}")), [value]);
        }

        assert_eq!(
            detect(&detector, "ITIN: 970-70-1234")[0].reasons,
            ["us_itin.format", "us_itin.context"]
        );

        for text in [
            "ITIN: 870-70-1234",
            "ITIN: 970-69-1234",
            "ITIN: 970-89-1234",
            "ITIN: 970-90-1234",
            "ITIN: 970-70-123",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    /// The longest label is 41 UTF-16 units, past the 40-unit left window,
    /// so it only counts after the value. Same as TS.
    #[test]
    fn longest_label_exceeds_the_left_window() {
        let detector = detector();
        let label = "individual taxpayer identification number";

        assert!(values(&detector, &format!("{label}: 970-70-1234")).is_empty());
        assert_eq!(
            values(&detector, &format!("970-70-1234 {label}")),
            ["970-70-1234"]
        );
    }
}
