//! Australian Tax File Number. Mirrors `national-id/au-tfn.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

const WEIGHTS: [u32; 9] = [1, 4, 3, 7, 5, 8, 6, 9, 10];

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "au_tfn",
        entity_type: "au_tfn",
        replacement: "[AU_TFN]",
        // Leftmost-first alternation, as in JS.
        pattern: LazyLock::new(|| {
            regex(r"[0-9]{3} [0-9]{3} [0-9]{3}|[0-9]{3} [0-9]{3} [0-9]{2}|[0-9]{8,9}")
        }),
        validate: tfn_valid,
        stream: StreamMeta::new(11, 0, 0),
    }
}

/// Mirrors `tfnValid` over the candidate with its spaces removed.
fn tfn_valid(candidate: &str) -> Option<&'static [&'static str]> {
    let digits = candidate.bytes().filter(|byte| *byte != b' ');

    if !(8..=9).contains(&digits.clone().count()) {
        return None;
    }

    let sum: u32 = digits
        .zip(WEIGHTS)
        .map(|(digit, weight)| u32::from(digit - b'0') * weight)
        .sum();

    if sum % 11 != 0 {
        return None;
    }

    Some(&["au_tfn.checksum", "au_tfn.format"])
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{detect, spans, values};
    use super::*;

    #[test]
    fn valid_numbers() {
        let detector = detector();

        for value in [
            "123456782",
            "123 456 782",
            "234567808",
            "234 567 808",
            "12345679",
            "100 000 06",
        ] {
            assert_eq!(values(&detector, value), [value]);
        }
    }

    #[test]
    fn surroundings() {
        let detector = detector();

        assert_eq!(
            values(&detector, "First: 123456782, Second: 234 567 808"),
            ["123456782", "234 567 808"]
        );
        assert_eq!(values(&detector, "(123456782)."), ["123456782"]);
        assert_eq!(spans(&detector, "😀 123456782"), [(5, 14)]);
        assert_eq!(
            detect(&detector, "TFN: 123 456 782")[0].reasons,
            ["au_tfn.checksum", "au_tfn.format"]
        );
    }

    #[test]
    fn invalid_numbers() {
        let detector = detector();

        for text in [
            "123456789",
            "123 456 789",
            "1234567",
            "1234567890",
            "12345678",
            "123456782extra",
            "extra123456782",
            "123456782_",
            "_123456782",
            "123456782\u{301}",
            "𝟙123456782",
            "123456782𝟙",
            "123 456 78",
            "12 3456 782",
            "00000000000000000000",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
