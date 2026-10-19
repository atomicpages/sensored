//! Japan My Number (Individual Number). Mirrors `national-id/jp-my-number.ts`.

use std::sync::LazyLock;

use super::{ascii_digits, regex};
use crate::detector::{ChecksumDetector, StreamMeta};

const WEIGHTS: [u32; 11] = [6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "jp_my_number",
        entity_type: "jp_my_number",
        replacement: "[JP_MY_NUMBER]",
        // Leftmost-first alternation, as in JS.
        pattern: LazyLock::new(|| regex(r"[0-9]{4} [0-9]{4} [0-9]{4}|[0-9]{12}")),
        validate: my_number_valid,
        stream: StreamMeta::new(14, 0, 0),
    }
}

/// Mirrors `myNumberValid` over the candidate with its spaces removed. The
/// pattern guarantees 12 digits.
fn my_number_valid(candidate: &str) -> Option<&'static [&'static str]> {
    let mut digits = ascii_digits(candidate);

    // Weights first: `zip` pulls from its left side first, so the check
    // digit stays in `digits`.
    let sum: u32 = WEIGHTS
        .into_iter()
        .zip(digits.by_ref())
        .map(|(weight, digit)| digit * weight)
        .sum();

    let remainder = sum % 11;
    let check = if remainder <= 1 { 0 } else { 11 - remainder };

    if digits.next() != Some(check) {
        return None;
    }

    Some(&["jp_my_number.checksum", "jp_my_number.format"])
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{detect, spans, values};
    use super::*;

    #[test]
    fn valid_numbers() {
        let detector = detector();

        for value in ["123456789018", "1234 5678 9018", "000000000000"] {
            assert_eq!(values(&detector, value), [value]);
        }
    }

    #[test]
    fn surroundings() {
        let detector = detector();

        assert_eq!(
            values(&detector, "123456789018 and 1234 5678 9018"),
            ["123456789018", "1234 5678 9018"]
        );
        assert_eq!(values(&detector, "(123456789018)."), ["123456789018"]);
        assert_eq!(spans(&detector, "My Number: 1234 5678 9018"), [(11, 25)]);
        assert_eq!(
            detect(&detector, "123456789018")[0].reasons,
            ["jp_my_number.checksum", "jp_my_number.format"]
        );
    }

    #[test]
    fn invalid_numbers() {
        let detector = detector();

        for text in [
            "123456789012",
            "1234 5678 9012",
            "12345678901",
            "1234567890123",
            "1234  5678 9018",
            "1234-5678-9018",
            "123456789018extra",
            "extra123456789018",
            "123456789018_",
            "_123456789018",
            "123456789018\u{301}",
            "\u{1D7D9}123456789018",
            "123456789018\u{1D7D9}",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
