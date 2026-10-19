//! Background check, drug test and disciplinary identifiers. Mirrors
//! `hr/hr-screening.ts`.

use std::sync::LazyLock;

use super::{has_ascii_digit, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Background Check ID|BGC ID|Screening ID|Drug Test ID|Urinalysis ID|Disciplinary Action No|Incident No|Warning No|Violation No|Background Check|BGC|Screening|Drug Test|Urinalysis|Disciplinary|Incident|Warning|Violation)";
const WINDOW: (usize, usize) = (40, 20);

fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    if !has_ascii_digit(candidate) {
        return None;
    }

    Some(&["hr_screening.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "hr_screening",
        entity_type: "hr_screening",
        replacement: "[HR_SCREENING]",
        // `/gi` without `u`: ASCII letters in either case.
        pattern: LazyLock::new(|| regex(r"[A-Za-z0-9]{7,14}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Background Check ID",
            "BGC ID",
            "Screening ID",
            "Drug Test ID",
            "Urinalysis ID",
            "Disciplinary Action No",
            "Incident No",
            "Warning No",
            "Violation No",
            "Background Check",
            "BGC",
            "Screening",
            "Drug Test",
            "Urinalysis",
            "Disciplinary",
            "Incident",
            "Warning",
            "Violation",
        ],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(25, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{spans, values};
    use super::*;

    #[test]
    fn detects_labelled_identifiers() {
        let cases = [
            ("Background Check ID: BGC1234567", "BGC1234567"),
            ("Drug Test ID: DT1234567", "DT1234567"),
            ("incident no: 12345678", "12345678"),
            ("DT1234567 (Drug Test)", "DT1234567"),
        ];

        for (text, value) in cases {
            assert_eq!(values(&detector(), text), [value], "{text}");
        }
    }

    #[test]
    fn rejects_bad_format_or_context() {
        let cases = [
            "Warning: ABCDEFGHI",
            "Incident No: AB1234",
            "Reference: BGC1234567",
            "BGC1234567",
            "Incident No: BGC1234567_",
        ];

        for text in cases {
            assert!(spans(&detector(), text).is_empty(), "{text}");
        }
    }
}
