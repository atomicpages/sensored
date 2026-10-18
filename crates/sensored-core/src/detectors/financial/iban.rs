//! IBAN for the SEPA countries. Mirrors `detectors/financial/iban.ts`.
//!
//! A match that fails the check drops trailing space-separated groups until
//! it passes, so prose after an IBAN does not hide it. Dropping stops at a
//! group of digits only.

use std::sync::LazyLock;

use regex::Regex;

use super::regex;
use crate::detector::{Detector, StreamMeta, is_end_forbidden, is_start_forbidden, push_aligned};
use crate::types::Detection;

const ID: &str = "iban";

const REASONS: &[&str] = &["iban.checksum", "iban.format"];

/// Upper bound on a compact IBAN, so validation never allocates.
const MAX_LENGTH: usize = 34;

/// IBAN length bounds, before the per-country check.
const LENGTH: std::ops::RangeInclusive<usize> = 15..=MAX_LENGTH;

static PATTERN: LazyLock<Regex> = LazyLock::new(|| regex(r"[A-Z]{2}[0-9]{2}(?: ?[A-Z0-9]{1,4})+"));

/// Mirrors `sepaCountryLengths`.
const SEPA_COUNTRY_LENGTHS: &[(&str, usize)] = &[
    ("AT", 20),
    ("BE", 16),
    ("BG", 22),
    ("CH", 21),
    ("CY", 28),
    ("CZ", 24),
    ("DE", 22),
    ("DK", 18),
    ("EE", 20),
    ("ES", 24),
    ("FI", 18),
    ("FR", 27),
    ("GB", 22),
    ("GR", 27),
    ("HR", 21),
    ("HU", 28),
    ("IE", 22),
    ("IS", 26),
    ("IT", 27),
    ("LI", 21),
    ("LT", 20),
    ("LU", 20),
    ("LV", 21),
    ("MC", 27),
    ("MT", 31),
    ("NL", 18),
    ("NO", 15),
    ("PL", 28),
    ("PT", 25),
    ("RO", 24),
    ("SE", 24),
    ("SI", 19),
    ("SK", 24),
];

pub struct IbanDetector;

impl Detector for IbanDetector {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[IBAN]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(38, 0, 0))
    }

    fn detect(&self, text: &str, out: &mut Vec<Detection>) {
        let mut candidates = Vec::new();

        for found in PATTERN.find_iter(text) {
            let start = found.start();

            if is_start_forbidden(text, start) {
                continue;
            }

            let Some(end) = valid_end(found.as_str()).map(|length| start + length) else {
                continue;
            };

            if is_end_forbidden(text, end) {
                continue;
            }

            candidates.push(Detection {
                start,
                end,
                rule_id: ID.to_owned(),
                entity_type: ID.to_owned(),
                reasons: REASONS.iter().map(|&reason| reason.to_owned()).collect(),
            });
        }

        push_aligned(text, candidates, out);
    }
}

/// The length of the longest valid prefix that ends where a group ends,
/// trying shorter ones only while the dropped group has a letter.
fn valid_end(found: &str) -> Option<usize> {
    let mut candidate = found;

    loop {
        if is_valid_iban(candidate) {
            return Some(candidate.len());
        }

        let last_space = candidate.rfind(' ')?;
        let removed = &candidate[last_space + 1..];

        if removed.bytes().all(|byte| byte.is_ascii_digit()) {
            return None;
        }

        candidate = &candidate[..last_space];
    }
}

/// Mirrors `isValidIban`. The pattern guarantees ASCII `A-Z`, `0-9` and spaces.
fn is_valid_iban(candidate: &str) -> bool {
    let mut compact = [0u8; MAX_LENGTH];
    let mut length = 0;

    for byte in candidate.bytes().filter(|&byte| byte != b' ') {
        if length == MAX_LENGTH {
            return false;
        }

        compact[length] = byte;
        length += 1;
    }

    let iban = &compact[..length];

    if !LENGTH.contains(&length) {
        return false;
    }

    let expected = SEPA_COUNTRY_LENGTHS
        .iter()
        .find(|(country, _)| country.as_bytes() == &iban[..2])
        .map(|&(_, expected)| expected);

    expected == Some(length) && mod97(iban) == 1
}

/// ISO 13616 mod 97 over the rearranged IBAN, letters as `A` = 10 to `Z` = 35.
///
/// TS builds the decimal string and reduces it with `BigInt`. Folding one
/// digit (or one two-digit letter value) at a time keeps the remainder below
/// 97, so it fits any integer and gives the same result.
fn mod97(iban: &[u8]) -> u32 {
    let (head, tail) = iban.split_at(4);

    tail.iter().chain(head).fold(0, |remainder, &byte| {
        if byte.is_ascii_digit() {
            (remainder * 10 + u32::from(byte - b'0')) % 97
        } else {
            (remainder * 100 + u32::from(byte) - 55) % 97
        }
    })
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{detect, spans, values};
    use super::*;

    const VALID: &[&str] = &[
        "GB82 WEST 1234 5698 7654 32",
        "DE89 3704 0044 0532 0130 00",
        "FR14 2004 1010 0505 0001 3M02 606",
        "IT60 X054 2811 1010 0000 0123 456",
        "NL91 ABNA 0417 1643 00",
        "BE68 5390 0754 7034",
        "CH93 0076 2011 6238 5295 7",
        "AT61 1904 3002 3457 3201",
        "ES91 2100 0418 4502 0005 1332",
        "SE45 5000 0000 0583 9825 7466",
        "NO93 8601 1117 947",
        "MT33 MALT 0110 0123 4567 8901 2345 600",
        "GB82WEST12345698765432",
        "DE89370400440532013000",
        "NL91ABNA0417164300",
        "BE68539007547034",
        "NO9386011117947",
    ];

    /// From `test/iban.test.ts`.
    #[test]
    fn detects_ibans() {
        for &value in VALID {
            assert_eq!(values(&IbanDetector, value), [value]);
        }

        let iban = "GB82 WEST 1234 5698 7654 32";

        for text in [
            format!("IBAN: {iban}"),
            format!("{iban}."),
            format!("({iban})"),
            format!("before {iban} after"),
            format!("\u{1F600} {iban}"),
        ] {
            assert_eq!(values(&IbanDetector, &text), [iban], "{text}");
        }

        assert_eq!(
            values(
                &IbanDetector,
                "GB82 WEST 1234 5698 7654 32, DE89 3704 0044 0532 0130 00"
            ),
            ["GB82 WEST 1234 5698 7654 32", "DE89 3704 0044 0532 0130 00"]
        );
        assert_eq!(spans(&IbanDetector, &format!("IBAN: {iban}")), [(6, 33)]);
    }

    /// From `test/iban.test.ts`.
    #[test]
    fn rejects_non_ibans() {
        for text in [
            "GB82 WEST 1234 5698 7654 33",
            "DE89 3704 0044 0532 0130 01",
            "XX12 3456 7890",
            "GB82 1234",
            "GB82 WEST 1234 5698 7654 32 12",
            "1234567890",
            "+44 20 7946 0958",
            "xGB82WEST12345698765432x",
            "_GB82WEST12345698765432",
            "GB82WEST12345698765432_",
            "GB82WEST12345698765432\u{301}",
            "\u{1D7D9}GB82WEST12345698765432",
            "GB82WEST12345698765432\u{1D7D9}",
            "AB12CD34EF56",
            "GB82",
        ] {
            assert!(values(&IbanDetector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn trims_trailing_groups_with_letters() {
        let iban = "GB82 WEST 1234 5698 7654 32";

        // `AND` and `X1` are dropped; the IBAN ends where `32` ends.
        assert_eq!(values(&IbanDetector, &format!("{iban} AND X1")), [iban]);

        // `32X` is one group: dropping it exposes `7654`, a digits-only
        // group, so trimming stops there.
        assert!(values(&IbanDetector, &format!("{iban}X")).is_empty());
    }

    #[test]
    fn reasons() {
        let found = detect(&IbanDetector, "GB82WEST12345698765432");

        assert_eq!(found[0].reasons, REASONS);
    }

    /// Remainders computed in TS with `BigInt(numeric) % 97n`.
    #[test]
    fn mod97_matches_bigint() {
        let cases: &[(&str, u32)] = &[
            ("GB82WEST12345698765432", 1),
            ("GB82WEST12345698765433", 28),
            ("DE89370400440532013001", 28),
            ("FR1420041010050500013M02606", 1),
            ("FR1420041010050500013M02607", 28),
            ("IT60X0542811101000000123456", 1),
            ("MT33MALT01100123456789012345600", 1),
            ("MT33MALT01100123456789012345601", 28),
            ("LC55HEMM000100010012001200023015", 1),
            ("ZZ00ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ", 39),
            ("AA00000000000000000000000000000000", 23),
        ];

        for &(iban, expected) in cases {
            assert_eq!(mod97(iban.as_bytes()), expected, "{iban}");
        }
    }
}
