//! Polish PESEL number. Mirrors `national-id/pl-pesel.ts`.

use std::sync::LazyLock;

use super::{ascii_digits, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:PESEL|Polish ID|National ID|Identity Number)";
const WINDOW: (usize, usize) = (30, 20);

const WEIGHTS: [u32; 11] = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3, 1];

/// Mirrors `peselValid`: the weighted sum, check digit included, is a
/// multiple of 10. The pattern guarantees 11 digits.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let sum: u32 = ascii_digits(candidate)
        .zip(WEIGHTS)
        .map(|(digit, weight)| digit * weight)
        .sum();

    (sum % 10 == 0).then_some(&["pl_pesel.checksum"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "pl_pesel",
        entity_type: "pl_pesel",
        replacement: "[PL_PESEL]",
        pattern: LazyLock::new(|| regex(r"[0-9]{11}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["PESEL", "Polish ID", "National ID", "Identity Number"],
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

        for label in ["PESEL", "Polish ID", "National ID", "Identity Number"] {
            assert_context_shape(&detector, label, "44051401458");
        }
    }

    #[test]
    fn checksum() {
        let detector = detector();

        for value in ["44051401458", "10000061725", "00000000000"] {
            let text = format!("PESEL: {value}");

            assert_eq!(values(&detector, &text), [value], "{text}");
        }

        for text in [
            "PESEL: 44051401459",
            "PESEL: 4405140145",
            "PESEL: 440514014588",
            "44051401458",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn multiple_and_reasons() {
        let detector = detector();
        let text = "PESEL 44051401458 and PESEL 10000061725";

        assert_eq!(spans(&detector, text), [(6, 17), (28, 39)]);
        assert_eq!(
            detect(&detector, text)[0].reasons,
            ["pl_pesel.checksum", "pl_pesel.context"]
        );
    }
}
