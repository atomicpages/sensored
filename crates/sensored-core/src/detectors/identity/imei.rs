//! IMEI and IMEISV numbers with a valid Luhn check. Mirrors `identity/imei.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::checksum::luhn_valid;
use crate::detector::{ChecksumDetector, StreamMeta};

fn all_same_digit(digits: &str) -> bool {
    let bytes = digits.as_bytes();

    bytes.iter().all(|&byte| byte == bytes[0])
}

/// Candidates are ASCII digits, so byte length equals the TS UTF-16 length.
/// An IMEISV (16 digits) is checked on its first 15.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    if candidate.len() != 15 && candidate.len() != 16 {
        return None;
    }

    if all_same_digit(candidate) {
        return None;
    }

    if !luhn_valid(&candidate[..15]) {
        return None;
    }

    Some(&["imei.luhn", "imei.format"])
}

pub fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "imei",
        entity_type: "imei",
        replacement: "[IMEI]",
        pattern: LazyLock::new(|| Regex::new(r"[0-9]{15,16}").expect("valid pattern")),
        validate,
        stream: StreamMeta::new(16, 0, 0),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detectors::identity::test_support::{spans, values};

    /// From `test/imei.test.ts`.
    #[test]
    fn detects_valid_imeis() {
        let cases = [
            ("490154203237518", "490154203237518"),
            ("4901542032375180", "4901542032375180"),
            ("IMEI: 490154203237518", "490154203237518"),
            ("Device 356938035643809 online", "356938035643809"),
            ("IMEI 490154203237518.", "490154203237518"),
            ("(490154203237518)", "490154203237518"),
            ("\u{1F44D}490154203237518", "490154203237518"),
            ("490154203237518\u{1F44D}", "490154203237518"),
        ];

        for (text, value) in cases {
            assert_eq!(values(&detector(), text), [value], "{text}");
        }

        assert_eq!(
            spans(&detector(), "490154203237518 and 356938035643809"),
            [(0, 15), (20, 35)]
        );
    }

    /// From `test/imei.test.ts`.
    #[test]
    fn rejects_invalid_or_embedded() {
        let cases = [
            "",
            "49015420323751",
            "49015420323751800",
            "490154203237519",
            "4901542032375190",
            "000000000000000",
            "0000000000000000",
            "x490154203237518",
            "490154203237518x",
            "490154203237518_",
            "_490154203237518",
        ];

        for text in cases {
            assert!(spans(&detector(), text).is_empty(), "{text}");
        }
    }

    #[test]
    fn reasons() {
        let mut out = Vec::new();
        crate::detector::Detector::detect(&detector(), "490154203237518", &mut out);

        assert_eq!(out[0].reasons, ["imei.luhn", "imei.format"]);
    }
}
