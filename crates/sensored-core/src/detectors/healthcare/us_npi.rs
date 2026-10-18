//! Mirrors `detectors/healthcare/us-npi.ts`. The TS `detect` is the checksum
//! pipeline with no context, so this is a `ChecksumDetector`.

use std::sync::LazyLock;

use super::regex;
use crate::checksum::npi_luhn_valid;
use crate::detector::{ChecksumDetector, StreamMeta};

fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    if !npi_luhn_valid(candidate) {
        return None;
    }

    Some(&["us_npi.checksum", "us_npi.format"])
}

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "us_npi",
        entity_type: "us_npi",
        replacement: "[US_NPI]",
        pattern: LazyLock::new(|| regex(r"[0-9]{10}")),
        validate,
        stream: StreamMeta::new(10, 0, 0),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/us-npi.test.ts`.
    #[test]
    fn detects_valid_npis() {
        let cases = [
            "1234567893",
            "NPI: 1234567893 here",
            "1234567893 is the NPI",
            "The NPI is 1234567893",
            "NPI 1234567893.",
        ];

        for input in cases {
            assert_eq!(values(&detector(), input), ["1234567893"], "{input}");
        }
    }

    /// From `test/us-npi.test.ts`.
    #[test]
    fn rejects_bad_checksum_or_adjacency() {
        let cases = [
            "1234567890",
            "123456789",
            "foo1234567893bar",
            "_1234567893",
            "1234567893_",
            "12345678931",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }
}
