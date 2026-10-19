//! Mirrors `detectors/healthcare/clinical-trial-id.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::ts_ascii_ci;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Trial|Study|Protocol|Research|Clinical|Participant|Subject)";
const WINDOW: (usize, usize) = (40, 20);

fn pattern() -> Regex {
    ts_ascii_ci(
        r"(?:PARTICIPANT|SUBJECT|TRIAL){sep}?(?:ID|NO|NUM(?:BER)?)?{sep}?[:#]?{s}*[A-Z]{1,2}-?\d{4,6}|(?:PROTOCOL|STUDY){sep}?(?:NO|NUM(?:BER)?|ID)?{sep}?[:#]?{s}*[A-Z0-9]{6,15}",
    )
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "clinical_trial_id",
        entity_type: "clinical_trial_id",
        replacement: "[CLINICAL_TRIAL_ID]",
        pattern: LazyLock::new(pattern),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Trial",
            "Study",
            "Protocol",
            "Research",
            "Clinical",
            "Participant",
            "Subject",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(25, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/clinical-trial-id.test.ts`.
    #[test]
    fn detects_ids_with_context() {
        let cases = [
            ("Clinical Trial ID: AB1234", "Trial ID: AB1234"),
            ("Research Subject NO: CD5678", "Subject NO: CD5678"),
            ("Clinical Participant ID: EF9012", "Participant ID: EF9012"),
            ("Research Protocol ABC12345", "Protocol ABC12345"),
            ("Clinical Study NO: XYZ987654", "Study NO: XYZ987654"),
            (
                "Clinical Study ID: PROTOCOL12345",
                "Study ID: PROTOCOL12345",
            ),
            ("clinical trial id: ab1234", "trial id: ab1234"),
            ("Clinical Trial ID: AB123456", "Trial ID: AB123456"),
            ("Trial ID: AB1234 (Clinical)", "Trial ID: AB1234"),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&detector(), input), [expected], "{input}");
        }
    }

    /// From `test/clinical-trial-id.test.ts`.
    #[test]
    fn rejects_without_context_or_format() {
        let cases = [
            "Trial ID: AB1234",
            "Reference: Trial ID: AB1234",
            "Clinical Trial ID: AB123",
            "Clinical xTrial ID: AB1234",
            "Research Protocol ABCDEFGHIJKLMNOP1234",
            "Clinical Trial ID: AB1234567",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }

    #[test]
    fn case_folding_is_ascii_only() {
        // U+017F (long s) folds to `s` under Unicode rules, not in JS without `u`.
        assert!(values(&detector(), "Clinical \u{17F}ubject ID: AB1234").is_empty());
        assert!(values(&detector(), "Clinical Trial ID: \u{212A}B1234").is_empty());
    }

    #[test]
    fn js_whitespace_includes_bom_but_not_nel() {
        assert_eq!(
            values(&detector(), "Clinical Trial\u{FEFF}AB1234"),
            ["Trial\u{FEFF}AB1234"]
        );
        assert!(values(&detector(), "Clinical Trial\u{85}AB1234").is_empty());
    }
}
