//! Mirrors `detectors/healthcare/medical-reference.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::ts_ascii_ci;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str =
    "(?:Lab|Test|Sample|Specimen|Pathology|Prescription|RX|Vaccine|Vaccination|Immunization)";
const WINDOW: (usize, usize) = (40, 20);

fn pattern() -> Regex {
    ts_ascii_ci(concat!(
        r"(?:LAB|TEST|SAMPLE){sep}?(?:ID|NUM(?:BER)?|REF)?{sep}?[:#]?{s}*[A-Z0-9]{6,12}",
        r"|(?:RX|PRESC(?:RIPTION)?|SCRIPT){sep}?(?:NO|NUM(?:BER)?|REF|ID)?{sep}?[:#]?{s}*[A-Z0-9]{6,12}",
        r"|(?:VACCINE|VACCINATION|IMMUNIZATION){sep}?(?:ID|RECORD|NO)?{sep}?[:#]?{s}*[A-Z0-9]{6,15}",
    ))
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "medical_reference",
        entity_type: "medical_reference",
        replacement: "[MEDICAL_REFERENCE]",
        pattern: LazyLock::new(pattern),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Lab",
            "Test",
            "Sample",
            "Specimen",
            "Pathology",
            "Prescription",
            "RX",
            "Vaccine",
            "Vaccination",
            "Immunization",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(30, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/medical-reference.test.ts`.
    #[test]
    fn detects_references_with_context() {
        let cases = [
            ("Pathology Lab ID: ABC123", "Lab ID: ABC123"),
            ("Pathology Test REF: XYZ789", "Test REF: XYZ789"),
            ("Pathology Sample ID: DEF456", "Sample ID: DEF456"),
            (
                "Pathology Prescription NO: RX123456",
                "Prescription NO: RX123456",
            ),
            ("Pathology RX Number: ABC123456", "RX Number: ABC123456"),
            ("Pathology Vaccine ID: VAC12345", "Vaccine ID: VAC12345"),
            (
                "Pathology Immunization NO: VAC987654321",
                "Immunization NO: VAC987654321",
            ),
            ("Specimen Lab ID: SP123456", "Lab ID: SP123456"),
            ("pathology lab id: abc123", "lab id: abc123"),
            ("Pathology Lab ID: ABC123456789", "Lab ID: ABC123456789"),
            (
                "Pathology Vaccine ID: ABC123456789012",
                "Vaccine ID: ABC123456789012",
            ),
            ("Lab ID: ABC123 (Pathology)", "Lab ID: ABC123"),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&detector(), input), [expected], "{input}");
        }
    }

    /// From `test/medical-reference.test.ts`.
    #[test]
    fn rejects_without_context_or_format() {
        let cases = [
            "Lab ID: ABC123",
            "Reference: Lab ID: ABC123",
            "Pathology Lab ID: ABC12",
            "Pathology xLab ID: ABC123",
            "Pathology Lab ID: ABC1234567890",
            "Pathology Prescription NO: RX12345678901",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }

    #[test]
    fn case_folding_is_ascii_only() {
        assert!(values(&detector(), "Pathology \u{17F}ample ID: DEF456").is_empty());
    }
}
