//! Bahrain CPR. Mirrors `national-id/bh-cpr.ts`.

use std::sync::LazyLock;

use super::{regex, two_digits};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Bahrain|CPR|Central Population|National ID)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `structurallyValid`: month 1-12 at digits 3-4, day 1-31 at
/// digits 5-6. The pattern guarantees nine ASCII digits.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let digits = candidate.as_bytes();
    let month = two_digits(digits, 2);
    let day = two_digits(digits, 4);

    ((1..=12).contains(&month) && (1..=31).contains(&day)).then_some(&["bh_cpr.structure"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "bh_cpr",
        entity_type: "bh_cpr",
        replacement: "[BH_CPR]",
        pattern: LazyLock::new(|| regex(r"[0-9]{9}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Bahrain", "CPR", "Central Population", "National ID"],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(9, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Bahrain", "CPR", "National ID"] {
            assert_context_shape(&detector, label, "881011501");
        }

        // `" (Central Population)"` is wider than the right window.
        assert_eq!(
            values(&detector, "Central Population: 881011501"),
            ["881011501"]
        );
        assert!(values(&detector, "881011501 (Central Population)").is_empty());
    }

    #[test]
    fn month_and_day() {
        let detector = detector();

        for value in ["880011501", "881311501", "881000501", "881032501"] {
            assert!(
                values(&detector, &format!("CPR: {value}")).is_empty(),
                "{value}"
            );
        }

        assert_eq!(
            values(
                &detector,
                "Bahrain CPR: 881011501 and Bahrain CPR: 891012502"
            ),
            ["881011501", "891012502"]
        );
    }

    #[test]
    fn length_and_reasons() {
        let detector = detector();

        assert!(values(&detector, "Bahrain CPR: 88101150").is_empty());
        assert!(values(&detector, "Bahrain CPR: 8810115012").is_empty());
        assert_eq!(
            detect(&detector, "Bahrain CPR: 881011501")[0].reasons,
            ["bh_cpr.structure", "bh_cpr.context"]
        );
    }
}
