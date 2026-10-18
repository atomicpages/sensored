//! Mirrors `detectors/financial/payment-card.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::checksum::luhn_valid;
use crate::detector::{ChecksumDetector, StreamMeta};

const MAX_LENGTH: usize = 37;
const MAX_GROUP: usize = 6;
const DIGITS: std::ops::RangeInclusive<usize> = 13..=19;

const REASONS: &[&str] = &["payment_card.luhn", "payment_card.format"];

pub fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "payment_card",
        entity_type: "payment_card",
        replacement: "[PAYMENT_CARD]",
        pattern: LazyLock::new(|| Regex::new(r"[0-9]+(?:[ -][0-9]+)*").expect("valid pattern")),
        validate,
        stream: StreamMeta::new(MAX_LENGTH, 0, 0),
    }
}

/// Digit groups split by one consistent separator (each 1-6 digits when
/// grouped), 13-19 digits, not all the same digit, Luhn-valid.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    // The pattern only matches ASCII, so bytes are UTF-16 units here.
    if candidate.len() > MAX_LENGTH {
        return None;
    }

    let mut digits = [0u8; MAX_LENGTH];
    let mut count = 0;
    let mut separator = None;
    let mut group = 0;

    for byte in candidate.bytes() {
        if byte.is_ascii_digit() {
            digits[count] = byte;
            count += 1;
            group += 1;

            continue;
        }

        if *separator.get_or_insert(byte) != byte {
            return None;
        }

        if !(1..=MAX_GROUP).contains(&group) {
            return None;
        }

        group = 0;
    }

    let digits = &digits[..count];

    let last_group_ok = group >= 1 && (separator.is_none() || group <= MAX_GROUP);

    if !last_group_ok || !DIGITS.contains(&count) || all_same(digits) {
        return None;
    }

    let digits = std::str::from_utf8(digits).ok()?;

    luhn_valid(digits).then_some(REASONS)
}

fn all_same(digits: &[u8]) -> bool {
    digits.iter().all(|&digit| digit == digits[0])
}

#[cfg(test)]
mod tests {
    use crate::detector::Detector;

    use super::*;

    fn spans(text: &str) -> Vec<&str> {
        let mut out = Vec::new();
        detector().detect(text, &mut out);

        out.iter().map(|d| &text[d.start..d.end]).collect()
    }

    /// From `test/payment-card.test.ts`.
    #[test]
    fn detects_cards() {
        let cases: &[(&str, &[&str])] = &[
            ("4242424242424242", &["4242424242424242"]),
            ("4242 4242 4242 4242", &["4242 4242 4242 4242"]),
            ("4242-4242-4242-4242", &["4242-4242-4242-4242"]),
            ("378282246310005", &["378282246310005"]),
            ("3782 822463 10005", &["3782 822463 10005"]),
            ("4222222222222", &["4222222222222"]),
            ("4242424242424242428", &["4242424242424242428"]),
            ("4242 4242 4242 4242 428", &["4242 4242 4242 4242 428"]),
            (
                "4-2-4-2-4-2-4-2-4-2-4-2-4-2-4-2-4-2-8",
                &["4-2-4-2-4-2-4-2-4-2-4-2-4-2-4-2-4-2-8"],
            ),
            (
                "4242424242424242 and 378282246310005",
                &["4242424242424242", "378282246310005"],
            ),
            ("4242424242424242.", &["4242424242424242"]),
            ("(4242424242424242)", &["4242424242424242"]),
        ];

        for (input, expected) in cases {
            assert_eq!(spans(input), *expected, "{input}");
        }
    }

    /// From `test/payment-card.test.ts`.
    #[test]
    fn rejects_non_cards() {
        let cases = [
            "4242 4242 4242 4241",
            "42424242424242424242",
            "4242424242424",
            "0000000000000",
            "4242 4242-4242-4242",
            "4242424242424242extra",
            "extra4242424242424242",
            "\u{1D7D9}424242424242424242",
            "4242424242424242\u{1D7D9}",
            "4242424242424242_",
            "_4242424242424242",
            "4242424242424242\u{301}",
            "1234567 4242424242424242",
            "4242424242424242 4242",
            "4242 4242 4242 4242 4242",
            "1234567 4242424242424242 4242",
        ];

        for input in cases {
            assert!(spans(input).is_empty(), "{input}");
        }
    }

    #[test]
    fn reasons() {
        let mut out = Vec::new();
        detector().detect("Card: 4242 4242 4242 4242", &mut out);

        assert_eq!((out[0].start, out[0].end), (6, 25));
        assert_eq!(out[0].reasons, REASONS);
    }

    #[test]
    fn last_group_is_capped_when_grouped() {
        assert!(spans("4242 424242424242").is_empty());
        assert_eq!(spans("4242424242424242"), ["4242424242424242"]);
    }
}
