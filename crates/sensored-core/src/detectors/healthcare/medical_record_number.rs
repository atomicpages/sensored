//! Mirrors `detectors/healthcare/medical-record-number.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = r"(?:mrn|medical[- ]?record[- ]?(?:no\.?|number)|record[- ]?(?:no\.?|number)|patient[- ]?id|chart[- ]?(?:no\.?|number))";
const WINDOW: (usize, usize) = (40, 40);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "medical_record_number",
        entity_type: "medical_record_number",
        replacement: "[MEDICAL_RECORD_NUMBER]",
        pattern: LazyLock::new(|| regex(r"[A-Z]{0,2}[0-9]{4,16}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "mrn",
            "medical record no.",
            "medical record no",
            "medical record number",
            "record no.",
            "record no",
            "record number",
            "patient id",
            "chart no.",
            "chart no",
            "chart number",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(18, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/medical-record-number.test.ts`.
    #[test]
    fn detects_numbers_with_context() {
        let cases = [
            ("MRN: 12345678", "12345678"),
            ("mrn: 12345678", "12345678"),
            ("Medical Record Number: 12345678", "12345678"),
            ("medical record no: 12345678", "12345678"),
            ("record number: 12345678", "12345678"),
            ("patient id: 12345678", "12345678"),
            ("chart number: 12345678", "12345678"),
            ("MRN: AB12345678", "AB12345678"),
            ("MRN: 1234", "1234"),
            ("Patient: MRN 12345678 done", "12345678"),
            ("The MRN 12345678", "12345678"),
            ("chart no. 12345678", "12345678"),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&detector(), input), [expected], "{input}");
        }
    }

    /// From `test/medical-record-number.test.ts`.
    #[test]
    fn rejects_without_context_or_format() {
        let cases = [
            "12345678",
            "phone: 12345678",
            "MRN: 123",
            "foo12345678bar",
            // No `i` flag: a lowercase prefix is not part of the match, so it is adjacent.
            "MRN: ab12345678",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }
}
