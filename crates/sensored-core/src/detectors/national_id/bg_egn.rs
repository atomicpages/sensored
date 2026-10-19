//! Bulgarian EGN. Mirrors `national-id/bg-egn.ts`.

use std::sync::LazyLock;

use super::{regex, two_digits};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Bulgaria|Bulgarian|EGN|Personal Number|Единен)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `structurallyValid`: month 1-12, 21-32 or 41-52 and day 1-31. The
/// pattern guarantees ten ASCII digits.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let digits = candidate.as_bytes();
    let month = two_digits(digits, 2);
    let day = two_digits(digits, 4);

    let month_valid = matches!(month, 1..=12 | 21..=32 | 41..=52);

    (month_valid && (1..=31).contains(&day)).then_some(&["bg_egn.structure"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "bg_egn",
        entity_type: "bg_egn",
        replacement: "[BG_EGN]",
        pattern: LazyLock::new(|| regex(r"[0-9]{10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Bulgaria", "Bulgarian", "EGN", "Personal Number", "Единен"],
        window: WINDOW,
        validate: Some(validate),
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

        for label in ["Bulgaria", "Bulgarian", "EGN", "Personal Number", "Единен"] {
            assert_context_shape(&detector, label, "9001011234");
        }
    }

    #[test]
    fn month_and_day() {
        let detector = detector();

        for value in ["9021011234", "9041011234", "9012311234", "7523124567"] {
            assert_eq!(values(&detector, &format!("EGN: {value}")), [value]);
        }

        for value in [
            "9000011234",
            "9013011234",
            "9033011234",
            "9053011234",
            "9001001234",
            "9001321234",
        ] {
            assert!(
                values(&detector, &format!("EGN: {value}")).is_empty(),
                "{value}"
            );
        }
    }

    #[test]
    fn length_and_reasons() {
        let detector = detector();

        assert!(values(&detector, "EGN: 900101123").is_empty());
        assert!(values(&detector, "EGN: 90010112345").is_empty());
        assert_eq!(
            detect(&detector, "EGN: 9001011234")[0].reasons,
            ["bg_egn.structure", "bg_egn.context"]
        );
    }
}
