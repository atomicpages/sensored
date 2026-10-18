//! Mirrors `detectors/contact/postal-code.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::detection;
use crate::detector::{Detector, StreamMeta, is_adjacent_forbidden, push_aligned};
use crate::types::Detection;

const ID: &str = "postal_code";

/// How far past the separator a neighbouring group is inspected.
const NEIGHBOUR_SCAN: usize = 6;

// TS compiles this with `gi` and no `u`: case folding is ASCII only.
static PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(concat!(
        r"[0-9]{5}(?:-[0-9]{4})?",
        r"|[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}",
        r"|[A-Za-z][0-9][A-Za-z] ?[0-9][A-Za-z][0-9]",
        r"|[0-9]{4}",
    ))
    .expect("valid pattern")
});

pub struct PostalCodeDetector;

impl Detector for PostalCodeDetector {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[POSTAL_CODE]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta {
            boundary_lookaround: 1 + NEIGHBOUR_SCAN,
            ..StreamMeta::new(10, 0, 0)
        })
    }

    fn detect(&self, text: &str, out: &mut Vec<Detection>) {
        let mut candidates = Vec::new();

        for found in PATTERN.find_iter(text) {
            let (start, end) = (found.start(), found.end());

            if is_adjacent_forbidden(text, start, end) {
                continue;
            }

            let digit_only = found
                .as_str()
                .bytes()
                .all(|byte| byte.is_ascii_digit() || byte == b'-');

            if digit_only && continues_digit_run(text.as_bytes(), start, end) {
                continue;
            }

            candidates.push(detection(ID, start, end, &["postal_code.format"]));
        }

        push_aligned(text, candidates, out);
    }
}

fn is_group_separator(byte: u8) -> bool {
    matches!(byte, b' ' | b'.' | b'-')
}

/// True when `group`, read outward from a separator, is all digits. Only the
/// nearest `NEIGHBOUR_SCAN` characters are read, which keeps the stream
/// lookaround bounded. A non-ASCII byte ends the group, as a non-ASCII UTF-16
/// unit does in TS.
fn is_digit_group(group: impl Iterator<Item = u8>) -> bool {
    let mut seen = 0;

    for byte in group.take(NEIGHBOUR_SCAN) {
        if !byte.is_ascii_alphanumeric() {
            break;
        }

        if !byte.is_ascii_digit() {
            return false;
        }

        seen += 1;
    }

    seen > 0
}

/// A digit-only candidate next to another digit group (`4111 1111`, `45-6789`,
/// `555.123`) is a slice of a longer number, not a postal code. A neighbour
/// holding letters (`K1A 1A1 2000`) is another postcode, so it does not count.
fn continues_digit_run(bytes: &[u8], start: usize, end: usize) -> bool {
    let before = start > 0
        && is_group_separator(bytes[start - 1])
        && is_digit_group(bytes[..start - 1].iter().rev().copied());

    let after = bytes.get(end).copied().is_some_and(is_group_separator)
        && is_digit_group(bytes[end + 1..].iter().copied());

    before || after
}

#[cfg(test)]
mod tests {
    use super::super::found;
    use super::*;

    #[test]
    fn finds_postal_codes() {
        for text in [
            "12345",
            "12345-6789",
            "SW1A 1AA",
            "M1 1AA",
            "DN55 1PT",
            "SW1A1AA",
            "K1A 1A1",
            "K1A1A1",
            "2000",
            "sw1a 1aa",
            "k1a 1a1",
        ] {
            assert_eq!(found(&PostalCodeDetector, text), [text]);
        }

        assert_eq!(
            found(&PostalCodeDetector, "12345 SW1A 1AA K1A 1A1 2000"),
            ["12345", "SW1A 1AA", "K1A 1A1", "2000"]
        );
        assert_eq!(
            found(&PostalCodeDetector, "Berlin, 10115 and 2000."),
            ["10115", "2000"]
        );
        assert_eq!(found(&PostalCodeDetector, "ZIP: 12345 - thanks"), ["12345"]);
        assert_eq!(found(&PostalCodeDetector, "😀 12345"), ["12345"]);
    }

    #[test]
    fn rejects_slices_of_longer_numbers() {
        for text in [
            "Card 4111 1111 1111 1111",
            "Card 4111-1111-1111-1111",
            "SSN 123-45-6789",
            "Call 555.123.4567",
            "Order 2024 12345 shipped",
            "1234-5678",
            "1234 5678 9012",
        ] {
            assert!(found(&PostalCodeDetector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn neighbour_scan_is_bounded_and_ascii() {
        // A letter beyond the scan window does not make the group alphanumeric.
        assert!(found(&PostalCodeDetector, "12345 123456x").is_empty());
        // A letter inside it does.
        assert_eq!(found(&PostalCodeDetector, "12345 12345x"), ["12345"]);
        // A non-ASCII neighbour ends the group before any digit is seen.
        assert_eq!(found(&PostalCodeDetector, "12345 \u{1d7d9}"), ["12345"]);
    }

    #[test]
    fn rejects_malformed_or_embedded_codes() {
        for text in [
            "123456",
            "123",
            "12345-67890",
            "SW1A 1AAA",
            "1SW 1AA",
            "K1A 1A11",
            "x12345",
            "12345_",
            "12345\u{301}",
            "\u{1d7d9}12345",
            "12345\u{1d7d9}",
            "1234567",
        ] {
            assert!(found(&PostalCodeDetector, text).is_empty(), "{text}");
        }
    }
}
