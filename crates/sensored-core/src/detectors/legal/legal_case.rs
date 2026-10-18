//! Mirrors `detectors/legal/legal-case.ts`.

use std::sync::LazyLock;

use super::{has_digit, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = r"(?:Case|Docket|Court|Subpoena|Summons|Judgment|Order|Decree|Bankruptcy|BK|Probate|Estate|Legal|Lawsuit)(?:[- \t]{1,8}No\.?)?";
const WINDOW: (usize, usize) = (40, 20);

fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    if !has_digit(candidate) {
        return None;
    }

    Some(&["legal_case.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "legal_case",
        entity_type: "legal_case",
        replacement: "[LEGAL_CASE]",
        // TS `/[A-Z0-9][-A-Z0-9]{5,15}/gi`, ASCII folding spelled out.
        pattern: LazyLock::new(|| regex(r"[A-Za-z0-9][-A-Za-z0-9]{5,15}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Case",
            "Case No.",
            "Case No",
            "Docket",
            "Docket No.",
            "Docket No",
            "Court",
            "Court No.",
            "Court No",
            "Subpoena",
            "Subpoena No.",
            "Subpoena No",
            "Summons",
            "Summons No.",
            "Summons No",
            "Judgment",
            "Judgment No.",
            "Judgment No",
            "Order",
            "Order No.",
            "Order No",
            "Decree",
            "Decree No.",
            "Decree No",
            "Bankruptcy",
            "Bankruptcy No.",
            "Bankruptcy No",
            "BK",
            "BK No.",
            "BK No",
            "Probate",
            "Probate No.",
            "Probate No",
            "Estate",
            "Estate No.",
            "Estate No",
            "Legal",
            "Legal No.",
            "Legal No",
            "Lawsuit",
            "Lawsuit No.",
            "Lawsuit No",
        ],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(16, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use crate::detector::Detector;

    use super::super::test_support::values;
    use super::*;

    /// From `test/legal-case.test.ts`.
    #[test]
    fn detects_cases_with_context() {
        let cases = [
            ("Case No: CV20210012345", "CV20210012345"),
            ("Docket No: ABC12345678", "ABC12345678"),
            ("Court Case: 12-34567AB890123", "12-34567AB890123"),
            ("Bankruptcy No: 12-34567", "12-34567"),
            ("BK No: 12-34567", "12-34567"),
            ("Lawsuit Docket: ABC123456789", "ABC123456789"),
            ("CASE# ABC12345678", "ABC12345678"),
            ("Case No: CV-2021-00123456", "CV-2021-00123456"),
            ("case no: cv20210012345", "cv20210012345"),
            ("CV20210012345 (Case)", "CV20210012345"),
            ("ABC12345678 (Docket)", "ABC12345678"),
            ("Case No: A12345", "A12345"),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&detector(), input), [expected], "{input}");
        }
    }

    /// From `test/legal-case.test.ts`.
    #[test]
    fn rejects_without_context_or_format() {
        let cases = [
            "Reference: ABC12345678",
            "ABC12345678",
            "myCase: ABC12345678",
            "Casex: ABC12345678",
            "Case:\nABC12345678",
            "Case:         ABC12345678",
            "Case No: ABCDEFGHIJ",
            "ABC12345678 (Reference)",
            "ABC12345678(Case)",
            "Case No: A1234",
            "Case No: ABC12345678901234",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }

    #[test]
    fn reasons() {
        let mut out = Vec::new();
        detector().detect("Case No: CV20210012345", &mut out);

        assert_eq!(out[0].reasons, ["legal_case.format", "legal_case.context"]);
    }
}
