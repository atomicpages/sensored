//! New Zealand IRD number. Mirrors `national-id/nz-ird.ts`.

use std::iter;
use std::sync::LazyLock;

use super::{ascii_digits, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = r"(?:ird[- ]?(?:no\.?|number)?|nz[- ]?ird|tax[- ]?(?:no\.?|number)?)";
const WINDOW: (usize, usize) = (40, 40);

const WEIGHTS: [u32; 8] = [3, 2, 7, 6, 5, 4, 3, 2];

/// Mirrors `validate` and `irdChecksum`: separators removed, an 8-digit
/// number padded to 9 with a leading zero, then a mod-11 check digit. A
/// remainder of 0 (or 1, giving check digit 10) never validates.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let count = ascii_digits(candidate).count();

    if !(8..=9).contains(&count) {
        return None;
    }

    let mut digits = iter::repeat_n(0, 9 - count).chain(ascii_digits(candidate));

    // Weights first: `zip` pulls from its left side first, so the check
    // digit stays in `digits`.
    let sum: u32 = WEIGHTS
        .into_iter()
        .zip(digits.by_ref())
        .map(|(weight, digit)| digit * weight)
        .sum();

    let remainder = sum % 11;

    if remainder == 0 || digits.next() != Some(11 - remainder) {
        return None;
    }

    Some(&["nz_ird.checksum", "nz_ird.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "nz_ird",
        entity_type: "nz_ird",
        replacement: "[NZ_IRD]",
        pattern: LazyLock::new(|| regex(r"[0-9]{2,3}[- ]?[0-9]{3}[- ]?[0-9]{3}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "ird",
            "ird no.",
            "ird no",
            "ird number",
            "nz ird",
            "tax",
            "tax no.",
            "tax no",
            "tax number",
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

        for label in ["IRD", "ird no.", "IRD Number", "tax", "Tax-No"] {
            assert_context_shape(&detector, label, "136-410-148");
        }

        // "nz ird" ends in the label "ird", so a word before it still leaves
        // a whole label.
        assert_eq!(values(&detector, "NZ IRD: 136410148"), ["136410148"]);
        assert_eq!(values(&detector, "myNZ IRD: 136410148"), ["136410148"]);
    }

    #[test]
    fn checksum() {
        let detector = detector();

        for value in [
            "136410148",
            "136-410-148",
            "136 410 148",
            "490918647",
            "490-918-647",
            "49091869",
            "49-091-869",
            "35 901 981",
        ] {
            let text = format!("IRD: {value}");

            assert_eq!(values(&detector, &text), [value], "{text}");
        }

        for text in [
            "IRD: 136410149",
            "IRD: 136410132",
            "IRD: 12345",
            "IRD: 136--410148",
            "IRD: 136410148_",
            "IRD: 136410148x",
            "IRD: 1364101480",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn remainder_zero_never_validates() {
        let detector = detector();

        // 2*7 + 4*2 = 22, a multiple of 11, whatever the check digit.
        assert!(values(&detector, "IRD: 002000040").is_empty());
        assert!(values(&detector, "IRD: 002000041").is_empty());
    }

    #[test]
    fn multiple_and_reasons() {
        let detector = detector();
        let text = "IRD: 136410148 and tax number 490-918-647";

        assert_eq!(spans(&detector, text), [(5, 14), (30, 41)]);
        assert_eq!(
            detect(&detector, text)[0].reasons,
            ["nz_ird.checksum", "nz_ird.format", "nz_ird.context"]
        );
    }
}
