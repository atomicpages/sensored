//! Mirrors `detectors/healthcare/us-dea.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = r"(?:dea[- ]?(?:no\.?|number)?|prescriber)";
const WINDOW: (usize, usize) = (40, 40);

/// TS `deaChecksum`: the sum of the first six digits, mod 10, is the seventh.
/// The pattern guarantees two letters then seven ASCII digits.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let digit = |b: &u8| u32::from(b - b'0');
    let digits = &candidate.as_bytes()[2..];
    let sum: u32 = digits[..6].iter().map(digit).sum();

    if sum % 10 != digit(&digits[6]) {
        return None;
    }

    Some(&["us_dea.checksum", "us_dea.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "us_dea",
        entity_type: "us_dea",
        replacement: "[US_DEA]",
        pattern: LazyLock::new(|| regex(r"[A-DF-MP-R][A-Z][0-9]{7}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["dea", "dea no.", "dea no", "dea number", "prescriber"],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(9, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/us-dea.test.ts`.
    #[test]
    fn detects_numbers_with_context() {
        let cases = [
            ("DEA: AB1234561", "AB1234561"),
            ("DEA: BB7654327", "BB7654327"),
            ("DEA: AB1234561 here", "AB1234561"),
            ("AB1234561 (DEA)", "AB1234561"),
            ("DEA AB1234561.", "AB1234561"),
            ("Prescriber: AB1234561", "AB1234561"),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&detector(), input), [expected], "{input}");
        }
    }

    /// From `test/us-dea.test.ts`.
    #[test]
    fn rejects_bad_checksum_letters_or_adjacency() {
        let cases = [
            "DEA: AB1234566",
            "DEA: EB1234561",
            "DEA: NB1234561",
            "DEA: SB1234561",
            "DEA: AB123456",
            "DEA: fooAB1234561bar",
            "DEA: _AB1234561",
            "DEA: AB1234561_",
            // No `i` flag.
            "DEA: ab1234561",
            "AB1234561",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }

    #[test]
    fn validate_reasons() {
        assert_eq!(
            validate("AB1234561"),
            Some(&["us_dea.checksum", "us_dea.format"][..])
        );
        assert_eq!(validate("AB1234566"), None);
    }
}
