//! Application, candidate, review and training identifiers. Mirrors
//! `hr/hr-recruitment.ts`.

use std::sync::LazyLock;

use super::{has_ascii_digit, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Application ID|Candidate ID|Applicant No|Application Ref|Resume ID|CV No|Curriculum Vitae No|Performance ID|Review ID|Appraisal No|Evaluation ID|Training ID|Certification ID|Cert No|Recruiter Ref|Agency ID|Application|Candidate|Applicant|Resume|CV|Curriculum Vitae|Performance|Review|Appraisal|Evaluation|Training|Certification|Cert|Recruiter|Agency)";
const WINDOW: (usize, usize) = (40, 20);

fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    if !has_ascii_digit(candidate) {
        return None;
    }

    Some(&["hr_recruitment.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "hr_recruitment",
        entity_type: "hr_recruitment",
        replacement: "[HR_RECRUITMENT]",
        // `/gi` without `u`: ASCII letters in either case.
        pattern: LazyLock::new(|| regex(r"[A-Za-z0-9]{7,14}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Application ID",
            "Candidate ID",
            "Applicant No",
            "Application Ref",
            "Resume ID",
            "CV No",
            "Curriculum Vitae No",
            "Performance ID",
            "Review ID",
            "Appraisal No",
            "Evaluation ID",
            "Training ID",
            "Certification ID",
            "Cert No",
            "Recruiter Ref",
            "Agency ID",
            "Application",
            "Candidate",
            "Applicant",
            "Resume",
            "CV",
            "Curriculum Vitae",
            "Performance",
            "Review",
            "Appraisal",
            "Evaluation",
            "Training",
            "Certification",
            "Cert",
            "Recruiter",
            "Agency",
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
            ("Application ID: APP1234567", "APP1234567"),
            ("Candidate: CAND12345", "CAND12345"),
            ("cv no: 12345678", "12345678"),
            ("REVIEW ID: RV1234567", "RV1234567"),
            ("RV1234567 (Review ID)", "RV1234567"),
        ];

        for (text, value) in cases {
            assert_eq!(values(&detector(), text), [value], "{text}");
        }
    }

    #[test]
    fn rejects_bad_format_or_context() {
        let cases = [
            // No digit.
            "Candidate: ABCDEFGHI",
            "Candidate: AB1234",
            "Candidate: AB1234567890123",
            "Reference: APP1234567",
            "APP1234567",
            "myCandidate: APP1234567",
        ];

        for text in cases {
            assert!(spans(&detector(), text).is_empty(), "{text}");
        }
    }

    #[test]
    fn reasons_come_from_validate() {
        let mut out = Vec::new();
        crate::detector::Detector::detect(&detector(), "Resume: CV1234567", &mut out);

        assert_eq!(
            out[0].reasons,
            ["hr_recruitment.format", "hr_recruitment.context"]
        );
    }
}
