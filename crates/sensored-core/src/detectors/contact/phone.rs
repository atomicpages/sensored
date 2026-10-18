//! Mirrors `detectors/contact/phone.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::detection;
use crate::checksum::npi_luhn_valid;
use crate::detector::{Detector, Input, StreamMeta, is_adjacent_forbidden, push_aligned};
use crate::types::Detection;

const ID: &str = "phone";
const MAX_MATCH: usize = 20;

static PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\+?\(?[0-9][0-9 ()\-]{0,16}[0-9]").expect("valid pattern"));

/// Date shapes a phone candidate must not have; `d` is a digit.
const DATE_SHAPES: &[&[u8]] = &[b"dddd-dd-dd", b"dd-dd-dddd"];

/// Digit counts accepted after `+` and each country code.
const PLUS_PREFIX_LENGTHS: &[(&[u8], &[usize])] = &[
    (b"1", &[11]),
    (b"44", &[12, 13]),
    (b"61", &[11]),
    (b"81", &[11]),
];

pub struct PhoneDetector;

impl Detector for PhoneDetector {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[PHONE]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(MAX_MATCH, 0, 0))
    }

    fn detect_in(&self, input: &Input<'_>, out: &mut Vec<Detection>) {
        let text = input.text();

        let mut candidates = Vec::new();

        for found in PATTERN.find_iter(text) {
            let (start, end) = (found.start(), found.end());

            if is_adjacent_forbidden(text, start, end) || !is_valid_phone(found.as_str()) {
                continue;
            }

            candidates.push(detection(ID, start, end, &["phone.format"]));
        }

        push_aligned(text, candidates, out);
    }
}

fn has_shape(candidate: &[u8], shape: &[u8]) -> bool {
    candidate.len() == shape.len()
        && candidate
            .iter()
            .zip(shape)
            .all(|(&byte, &expected)| match expected {
                b'd' => byte.is_ascii_digit(),
                _ => byte == expected,
            })
}

fn is_valid_phone(candidate: &str) -> bool {
    let bytes = candidate.as_bytes();

    if DATE_SHAPES.iter().any(|shape| has_shape(bytes, shape)) {
        return false;
    }

    // The pattern caps a candidate at `MAX_MATCH` ASCII bytes.
    let mut buffer = [0; MAX_MATCH];
    let mut len = 0;

    for &byte in bytes.iter().filter(|byte| byte.is_ascii_digit()) {
        buffer[len] = byte;
        len += 1;
    }

    let digits = &buffer[..len];

    let plausible = if bytes.starts_with(b"+") {
        PLUS_PREFIX_LENGTHS
            .iter()
            .any(|(prefix, lengths)| digits.starts_with(prefix) && lengths.contains(&len))
    } else {
        len == 10 || (len == 11 && digits.starts_with(b"0"))
    };

    // A 10-digit number that passes NPI Luhn is an NPI, not a phone number.
    plausible && !(len == 10 && std::str::from_utf8(digits).is_ok_and(npi_luhn_valid))
}

#[cfg(test)]
mod tests {
    use super::super::found;
    use super::*;

    #[test]
    fn finds_phone_numbers() {
        for text in [
            "1234567890",
            "123-456-7890",
            "(123) 456-7890",
            "+11234567890",
            "+1 (123) 456-7890",
            "02079460958",
            "020 7946 0958",
            "+44 20 7946 0958",
            "+4412345678901",
            "+61212345678",
            "+81312345678",
        ] {
            assert_eq!(found(&PhoneDetector, text), [text]);
        }

        assert_eq!(
            found(&PhoneDetector, "Call 123-456-7890."),
            ["123-456-7890"]
        );
        assert_eq!(
            found(&PhoneDetector, "123-456-7890, 098-765-4321"),
            ["123-456-7890", "098-765-4321"]
        );
    }

    #[test]
    fn rejects_non_phones() {
        for text in [
            "2023-12-25",
            "12-25-2023",
            "123456789",
            "123456789012",
            "+44123456789",
            "+44123456789012",
            "+6112345678",
            "+23456789012",
            "abc1234567890",
            "1234567890_",
            "1234567890\u{301}",
            "\u{1d7d9}1234567890",
            "1234567890\u{1d7d9}",
            "1234567893", // a valid NPI
        ] {
            assert!(found(&PhoneDetector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn offsets_are_bytes() {
        let mut out = Vec::new();
        PhoneDetector.detect("😀 123-456-7890", &mut out);

        assert_eq!((out[0].start, out[0].end), (5, 17));
    }
}
