//! Egyptian national ID. Mirrors `national-id/eg-id.ts`.

use std::sync::LazyLock;

use super::{number, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Egypt|Egyptian|National ID|Identity)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `structurallyValid`: month 1-12 at digits 6-7, day 1-31 at digits
/// 8-9. The pattern guarantees fourteen ASCII digits.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let digits = candidate.as_bytes();
    let month = number(&digits[5..7]);
    let day = number(&digits[7..9]);

    ((1..=12).contains(&month) && (1..=31).contains(&day)).then_some(&["eg_id.structure"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "eg_id",
        entity_type: "eg_id",
        replacement: "[EG_ID]",
        pattern: LazyLock::new(|| regex(r"[12][0-9]{13}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Egypt", "Egyptian", "National ID", "Identity"],
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

        for label in ["Egypt", "Egyptian", "National ID", "Identity"] {
            assert_context_shape(&detector, label, "29001011234567");
        }
    }

    #[test]
    fn structure() {
        let detector = detector();

        assert_eq!(
            values(
                &detector,
                "National ID: 29001011234567 and National ID: 18506051234567"
            ),
            ["29001011234567", "18506051234567"]
        );
        assert_eq!(
            values(&detector, "National ID: 19001011234567"),
            ["19001011234567"]
        );

        for value in [
            "39001011234567",
            "29001001234567",
            "29001131234567",
            "29001010034567",
            "29001013234567",
            "2900101123456",
            "290010112345678",
        ] {
            assert!(
                values(&detector, &format!("National ID: {value}")).is_empty(),
                "{value}"
            );
        }
    }

    #[test]
    fn spans_and_reasons() {
        let detector = detector();

        assert_eq!(
            spans(&detector, "National ID:        29001011234567"),
            [(20, 34)]
        );
        assert_eq!(spans(&detector, "29001011234567        (Egypt)"), [(0, 14)]);
        assert_eq!(
            detect(&detector, "National ID: 29001011234567")[0].reasons,
            ["eg_id.structure", "eg_id.context"]
        );
    }
}
