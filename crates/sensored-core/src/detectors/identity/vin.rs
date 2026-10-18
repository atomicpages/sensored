//! Vehicle identification numbers with a valid check digit. Mirrors `identity/vin.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::detector::{ChecksumDetector, StreamMeta};

const WEIGHTS: [u32; 17] = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/// The TS pattern has the `gi` flags without `u`: ASCII letters only.
const PATTERN: &str = r"[A-HJ-NPR-Za-hj-npr-z0-9]{17}";

/// The TS transliteration table has uppercase keys only, so a lowercase VIN
/// matches the pattern but never passes the checksum.
fn transliterate(byte: u8) -> Option<u32> {
    let value = match byte {
        b'0'..=b'9' => byte - b'0',
        b'A' | b'J' => 1,
        b'B' | b'K' | b'S' => 2,
        b'C' | b'L' | b'T' => 3,
        b'D' | b'M' | b'U' => 4,
        b'E' | b'N' | b'V' => 5,
        b'F' | b'W' => 6,
        b'G' | b'P' | b'X' => 7,
        b'H' | b'Y' => 8,
        b'R' | b'Z' => 9,
        _ => return None,
    };

    Some(u32::from(value))
}

fn checksum_valid(vin: &[u8]) -> bool {
    let mut sum = 0;

    for (&byte, weight) in vin.iter().zip(WEIGHTS) {
        let Some(value) = transliterate(byte) else {
            return false;
        };

        sum += value * weight;
    }

    let check = match sum % 11 {
        10 => b'X',
        digit => b'0' + u8::try_from(digit).expect("below 11"),
    };

    vin[8] == check
}

/// Candidates are ASCII, so byte length equals the TS UTF-16 length.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let bytes = candidate.as_bytes();

    if bytes.len() != 17 || !bytes.iter().any(u8::is_ascii_digit) {
        return None;
    }

    if bytes.iter().all(|&byte| byte == bytes[0]) {
        return None;
    }

    if !checksum_valid(bytes) {
        return None;
    }

    Some(&["vin.checksum", "vin.format"])
}

pub fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "vin",
        entity_type: "vin",
        replacement: "[VIN]",
        pattern: LazyLock::new(|| Regex::new(PATTERN).expect("valid pattern")),
        validate,
        stream: StreamMeta::new(17, 0, 0),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detectors::identity::test_support::{spans, values};

    #[test]
    fn matches_valid_vins() {
        let detector = detector();
        let vins = [
            "1HGCM82673A123456",
            "WP0ZZZ996TS402083",
            "2T1BURHE3JC012345",
            "1FTFW1ET9DFA12345",
            "JM1NC25F970123456",
            "WBA3D9C57AF123450",
        ];

        for vin in vins {
            assert_eq!(values(&detector, vin), [vin]);
        }

        assert_eq!(
            spans(&detector, "1HGCM82673A123456 and WP0ZZZ996TS402083"),
            [(0, 17), (22, 39)]
        );
    }

    #[test]
    fn rejects_invalid_candidates() {
        let detector = detector();
        let cases = [
            "1HGCM82633A123456",
            "1HGCM82673A12345",
            "1HGCM82673A12345I",
            "ABCDEFGHJKLMNPRSTUVWXYZ",
            "11111111111111111",
            "x1HGCM82673A123456",
            "1HGCM82673A123456x",
            "1hgcm82673a123456",
        ];

        for text in cases {
            assert!(spans(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn emoji_neighbours_are_not_adjacent() {
        assert_eq!(spans(&detector(), "\u{1F697}1HGCM82673A123456"), [(4, 21)]);
    }
}
