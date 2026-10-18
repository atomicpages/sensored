//! EU VAT identification number. Mirrors `detectors/financial/eu-vat.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::checksum::luhn_valid;
use crate::detector::{ChecksumDetector, StreamMeta};

const ES_LETTERS: &[u8; 23] = b"TRWAGMYFPDXBNJZSQVHLCKE";
const NL_WEIGHTS: [u32; 9] = [9, 8, 7, 6, 5, 4, 3, 2, 1];

const CHECKSUM: &[&str] = &["eu_vat.checksum", "eu_vat.format"];
const FORMAT: &[&str] = &["eu_vat.format"];

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "eu_vat",
        entity_type: "eu_vat",
        replacement: "[EU_VAT]",
        pattern: LazyLock::new(|| {
            regex(
                r"(?:DE[0-9]{9}|FR[A-Z]{2}[0-9]{11}|IT[0-9]{11}|ES[0-9]{8}[A-Z]?|NL[0-9]{9}B[0-9]{2})",
            )
        }),
        validate,
        stream: StreamMeta::new(15, 0, 0),
    }
}

/// Dispatches on the country prefix. The pattern guarantees each body's shape.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let (country, body) = candidate.split_at(2);

    match country {
        "DE" => Some(FORMAT),
        "FR" => luhn_valid(&body[2..]).then_some(CHECKSUM),
        "IT" => luhn_valid(body).then_some(CHECKSUM),
        "ES" => es_validate(body),
        "NL" => nl_valid(body).then_some(CHECKSUM),
        _ => None,
    }
}

/// Eight digits and an optional DNI check letter. Without the letter there is
/// nothing to check, so only the format reason is given.
fn es_validate(body: &str) -> Option<&'static [&'static str]> {
    let (digits, letter) = body.split_at(8);

    let Some(&letter) = letter.as_bytes().first() else {
        return Some(FORMAT);
    };

    let number: usize = digits.parse().ok()?;

    (ES_LETTERS[number % 23] == letter).then_some(CHECKSUM)
}

/// Nine weighted digits mod 11 against the two digits after `B`.
fn nl_valid(body: &str) -> bool {
    let bytes = body.as_bytes();

    let sum: u32 = bytes[..9]
        .iter()
        .zip(NL_WEIGHTS)
        .map(|(byte, weight)| u32::from(byte - b'0') * weight)
        .sum();

    let suffix = u32::from(bytes[10] - b'0') * 10 + u32::from(bytes[11] - b'0');

    sum % 11 == suffix
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{detect, values};
    use super::*;

    /// From `test/eu-vat.test.ts`.
    #[test]
    fn detects_vat_numbers() {
        let detector = detector();

        for value in [
            "DE123456789",
            "FRAB12345678903",
            "IT12345678903",
            "ES12345678Z",
            "ES12345678",
            "NL123456782B04",
        ] {
            assert_eq!(values(&detector, value), [value]);
            assert_eq!(values(&detector, &format!("VAT: {value}.")), [value]);
        }

        assert_eq!(
            values(
                &detector,
                "DE123456789 and FRAB12345678903 and IT12345678903"
            ),
            ["DE123456789", "FRAB12345678903", "IT12345678903"]
        );
        assert_eq!(values(&detector, "{DE123456789}"), ["DE123456789"]);
    }

    /// From `test/eu-vat.test.ts`.
    #[test]
    fn rejects_invalid_or_embedded() {
        let detector = detector();

        for text in [
            "DE12345678",
            "DE1234567890",
            "FRAB12345678907",
            "IT12345678907",
            "ES12345678X",
            "NL123456782B05",
            "DE123456789extra",
            "extraDE123456789",
            "DE123456789_",
            "_DE123456789",
            "DE123456789\u{301}",
            "\u{1D7D9}DE123456789",
            "DE123456789\u{1D7D9}",
            "FRAB1234567890",
            "IT1234567890",
            "ES1234567",
            "NL12345678B04",
            "NL123456782C04",
            "de123456789",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    /// From `test/eu-vat.test.ts`.
    #[test]
    fn reasons_depend_on_the_checksum() {
        let detector = detector();

        for (text, expected) in [
            ("DE123456789", FORMAT),
            ("FRAB12345678903", CHECKSUM),
            ("ES12345678Z", CHECKSUM),
            ("ES12345678", FORMAT),
            ("NL123456782B04", CHECKSUM),
        ] {
            assert_eq!(detect(&detector, text)[0].reasons, expected, "{text}");
        }
    }

    /// TS compares `sum % 11` with the suffix, so a suffix above 10 never passes.
    #[test]
    fn nl_suffix_is_the_remainder() {
        assert!(nl_valid("123456782B04"));
        assert!(!nl_valid("123456782B15"));
    }
}
