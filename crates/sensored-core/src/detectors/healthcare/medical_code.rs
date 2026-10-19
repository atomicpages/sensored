//! Mirrors `detectors/healthcare/medical-code.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str =
    "(?:Diagnosis|Condition|Disease|Disorder|ICD|Code|Procedure|CPT|Billing|Treatment|Service)";
const WINDOW: (usize, usize) = (35, 20);

const CPT_RANGE: std::ops::RangeInclusive<u32> = 100..=99_499;

/// A 5-digit candidate is a CPT code and must be in range; ICD-10 codes pass.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let is_cpt = candidate.len() == 5 && candidate.bytes().all(|b| b.is_ascii_digit());

    if is_cpt
        && !candidate
            .parse()
            .is_ok_and(|code| CPT_RANGE.contains(&code))
    {
        return None;
    }

    Some(&["medical_code.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "medical_code",
        entity_type: "medical_code",
        replacement: "[MEDICAL_CODE]",
        // TS `/[A-TV-Z]\d{2}(\.\d{1,2})?|\d{5}/gi`, ASCII folding spelled out.
        pattern: LazyLock::new(|| regex(r"[A-TV-Za-tv-z][0-9]{2}(?:\.[0-9]{1,2})?|[0-9]{5}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Diagnosis",
            "Condition",
            "Disease",
            "Disorder",
            "ICD",
            "Code",
            "Procedure",
            "CPT",
            "Billing",
            "Treatment",
            "Service",
        ],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(8, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/medical-code.test.ts`.
    #[test]
    fn detects_codes_with_context() {
        let cases = [
            ("Diagnosis: E11.9", "E11.9"),
            ("Diagnosis: A00", "A00"),
            ("ICD Code: S72.0", "S72.0"),
            ("Condition: J45.90", "J45.90"),
            ("CPT: 99213", "99213"),
            ("Procedure: 00100", "00100"),
            ("Billing: 99499", "99499"),
            ("diagnosis: e11.9", "e11.9"),
            ("icd: S72.01", "S72.01"),
            ("E11.9 (Diagnosis)", "E11.9"),
            ("99213 (CPT)", "99213"),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&detector(), input), [expected], "{input}");
        }
    }

    /// From `test/medical-code.test.ts`.
    #[test]
    fn rejects_without_context_or_format() {
        let cases = [
            "E11.9",
            "Reference: 99213",
            "E11.9 is the diagnosis",
            "The diagnosis is E11.9",
            "CPT: 00099",
            "CPT: 99500",
            "fooE11.9bar",
            "Diagnosis: E11.999",
            "CPT: 992130",
            "CPT: 9921",
            "Diagnosis: U00",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }

    #[test]
    fn multiple_codes() {
        assert_eq!(
            values(&detector(), "Diagnosis: E11.9, CPT: 99213"),
            ["E11.9", "99213"]
        );
    }

    #[test]
    fn validate_reasons() {
        assert_eq!(validate("00100"), Some(&["medical_code.format"][..]));
        assert_eq!(validate("99499"), Some(&["medical_code.format"][..]));
        assert_eq!(validate("00099"), None);
        assert_eq!(validate("99500"), None);
        assert_eq!(validate("E11"), Some(&["medical_code.format"][..]));
    }
}
