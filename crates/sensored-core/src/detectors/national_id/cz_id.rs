//! Czech rodné číslo. Mirrors `national-id/cz-id.ts`.

use std::sync::LazyLock;

use super::{number, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Czech|Czechia|Republic|Rodné|Číslo|National ID)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `structurallyValid`: month 1-12 or 51-62 and day 1-31. The pattern
/// guarantees `dddddd/dddd`, so the slash never shifts the date digits.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let digits = candidate.as_bytes();
    let month = number(&digits[2..4]);
    let day = number(&digits[4..6]);

    let month_valid = matches!(month, 1..=12 | 51..=62);

    (month_valid && (1..=31).contains(&day)).then_some(&["cz_id.structure"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "cz_id",
        entity_type: "cz_id",
        replacement: "[CZ_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{6}/[0-9]{4}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Czech",
            "Czechia",
            "Republic",
            "Rodné",
            "Číslo",
            "National ID",
        ],
        window: WINDOW,
        validate: Some(validate),
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
            "Czech",
            "Czechia",
            "Republic",
            "Rodné",
            "Číslo",
            "National ID",
        ] {
            assert_context_shape(&detector, label, "900101/1234");
        }

        assert_eq!(
            values(&detector, "Rodné číslo: 900101/1234"),
            ["900101/1234"]
        );
    }

    #[test]
    fn month_and_day() {
        let detector = detector();

        for value in ["905101/1234", "900131/1234", "906231/1234"] {
            assert_eq!(values(&detector, &format!("Czech: {value}")), [value]);
        }

        for value in [
            "900001/1234",
            "901301/1234",
            "906301/1234",
            "902101/1234",
            "900100/1234",
            "900132/1234",
        ] {
            assert!(
                values(&detector, &format!("Czech: {value}")).is_empty(),
                "{value}"
            );
        }
    }

    #[test]
    fn shape_and_reasons() {
        let detector = detector();

        for text in [
            "Czech: 9001011234",
            "Czech: 90010/1234",
            "Czech: 900101/123",
            "Czech: 900101/12345",
            "Czech: 0900101/1234",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }

        assert_eq!(
            detect(&detector, "Czech: 900101/1234")[0].reasons,
            ["cz_id.structure", "cz_id.context"]
        );
    }
}
