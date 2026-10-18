//! Dutch citizen service number (BSN). Mirrors `national-id/nl-bsn.ts`.

use std::sync::LazyLock;

use super::{ascii_digits, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:BSN|Burgerservicenummer|Dutch ID|Citizen Service Number)";
const WINDOW: (usize, usize) = (30, 20);

/// The eleven-proof weights 9..2, then -1 for the check digit. `-1` is
/// written as `10` (congruent mod 11), so the sum stays unsigned; JS's
/// signed `sum % 11 === 0` holds exactly when this one does.
const WEIGHTS: [u32; 9] = [9, 8, 7, 6, 5, 4, 3, 2, 10];

/// Mirrors `bsnValid` over the candidate with its dots removed. The pattern
/// guarantees 9 digits.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let sum: u32 = ascii_digits(candidate)
        .zip(WEIGHTS)
        .map(|(digit, weight)| digit * weight)
        .sum();

    (sum % 11 == 0).then_some(&["nl_bsn.checksum"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "nl_bsn",
        entity_type: "nl_bsn",
        replacement: "[NL_BSN]",
        // Leftmost-first alternation, as in JS.
        pattern: LazyLock::new(|| regex(r"[0-9]{3}\.[0-9]{3}\.[0-9]{3}|[0-9]{9}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "BSN",
            "Burgerservicenummer",
            "Dutch ID",
            "Citizen Service Number",
        ],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(11, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["BSN", "Dutch ID"] {
            assert_context_shape(&detector, label, "111222333");
        }

        // Too long for the 20-unit right window, so preceding only.
        for label in ["Burgerservicenummer", "Citizen Service Number"] {
            let text = format!("{label}: 111.222.333");

            assert_eq!(values(&detector, &text), ["111.222.333"]);
        }
    }

    #[test]
    fn checksum() {
        let detector = detector();

        for value in [
            "111222333",
            "123456782",
            "100000009",
            "123.456.782",
            "000000000",
        ] {
            let text = format!("BSN: {value}");

            assert_eq!(values(&detector, &text), [value], "{text}");
        }

        for text in [
            "BSN: 123456789",
            "BSN: 123.456.789",
            "BSN: 11122233",
            "BSN: 1112223334",
            "BSN: 111.222333",
            "BSN: 111-222-333",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn multiple_and_reasons() {
        let detector = detector();
        let text = "BSN 111222333 and BSN 123.456.782";

        assert_eq!(spans(&detector, text), [(4, 13), (22, 33)]);
        assert_eq!(
            detect(&detector, text)[0].reasons,
            ["nl_bsn.checksum", "nl_bsn.context"]
        );
    }
}
