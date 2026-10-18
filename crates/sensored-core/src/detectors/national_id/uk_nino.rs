//! UK National Insurance number. Mirrors `national-id/uk-nino.ts`.
//!
//! The TS class hand-writes `detect`, but its loop is the `ChecksumDetector`
//! pipeline (match, adjacency, validate, grapheme filter), so it is one here.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "uk_nino",
        entity_type: "uk_nino",
        replacement: "[UK_NINO]",
        // JS `/[A-Z]{2} ?\d{2} ?\d{2} ?\d{2} ?[A-Z]/gi`: ASCII folding only.
        pattern: LazyLock::new(|| regex(r"[A-Za-z]{2} ?[0-9]{2} ?[0-9]{2} ?[0-9]{2} ?[A-Za-z]")),
        validate: nino_valid,
        stream: StreamMeta::new(14, 0, 0),
    }
}

/// Mirrors `isValidNino`. The pattern guarantees ASCII letters at both ends.
fn nino_valid(candidate: &str) -> Option<&'static [&'static str]> {
    let bytes = candidate.as_bytes();
    let first = bytes.first()?.to_ascii_uppercase();
    let second = bytes.get(1)?.to_ascii_uppercase();
    let suffix = bytes.last()?.to_ascii_uppercase();

    if b"DFIQUV".contains(&first) || second == b'O' {
        return None;
    }

    if !b"ABCDFJHMNPRSTWXYZ".contains(&suffix) {
        return None;
    }

    Some(&["uk_nino.format"])
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{detect, spans, values};
    use super::*;

    #[test]
    fn valid_numbers() {
        let detector = detector();

        for value in [
            "AB123456C",
            "AB 12 34 56 C",
            "JH123456A",
            "CE123456D",
            "BG123456F",
            "KT123456J",
            "NP123456H",
            "RW123456M",
            "SN123456N",
            "TP123456P",
            "WL123456R",
            "YM123456S",
            "ZP123456T",
            "AC123456W",
            "EA123456X",
            "GH123456Y",
            "JK123456Z",
            "ab123456c",
        ] {
            assert_eq!(values(&detector, value), [value]);
        }
    }

    #[test]
    fn surroundings() {
        let detector = detector();

        assert_eq!(values(&detector, "NINO: AB 12 34 56 C."), ["AB 12 34 56 C"]);
        assert_eq!(values(&detector, "(AB123456C)"), ["AB123456C"]);
        assert_eq!(
            values(&detector, "AB123456C JH123456A CE123456D"),
            ["AB123456C", "JH123456A", "CE123456D"]
        );
        assert_eq!(spans(&detector, "😀 AB123456C"), [(5, 14)]);
        assert_eq!(
            detect(&detector, "NINO: AB123456C")[0].reasons,
            ["uk_nino.format"]
        );
    }

    #[test]
    fn invalid_numbers() {
        let detector = detector();

        for text in [
            "DB123456C",
            "FB123456C",
            "IB123456C",
            "QB123456C",
            "UB123456C",
            "VB123456C",
            "AO123456C",
            "AB123456E",
            "AB123456G",
            "AB123456I",
            "AB123456K",
            "AB123456L",
            "AB123456O",
            "AB123456Q",
            "AB123456U",
            "AB123456V",
            "AB12345C",
            "AB1234567C",
            "xAB123456C",
            "AB123456Cx",
            "AB123456C_",
            "_AB123456C",
            "1AB123456C",
            "AB123456C1",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
