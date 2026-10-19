//! Employee, payroll and timesheet identifiers. Mirrors `hr/hr-identifier.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Employee ID|EMP-ID|Staff No|Personnel ID|Worker ID|Payroll No|PAY ID|Timesheet No|Timecard ID|Time-Entry No)";
const WINDOW: (usize, usize) = (40, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "hr_identifier",
        entity_type: "hr_identifier",
        replacement: "[HR_IDENTIFIER]",
        // `/gi` without `u`: ASCII letters in either case.
        pattern: LazyLock::new(|| regex(r"[A-Za-z]{0,3}[0-9]{4,10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Employee ID",
            "EMP-ID",
            "Staff No",
            "Personnel ID",
            "Worker ID",
            "Payroll No",
            "PAY ID",
            "Timesheet No",
            "Timecard ID",
            "Time-Entry No",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(25, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{spans, values};
    use super::*;

    /// From `test/hr-identifier.test.ts`.
    #[test]
    fn detects_labelled_identifiers() {
        let cases = [
            ("Employee ID: EMP123456", (13, 22)),
            ("Employee ID: 12345678", (13, 21)),
            ("EMP-ID: AB123456", (8, 16)),
            ("Personnel ID: 123456", (14, 20)),
            ("Time-Entry No: TE123456789", (15, 26)),
            ("employee id: EMP123456", (13, 22)),
            ("Employee ID:EMP123456", (12, 21)),
            ("Employee ID# 12345678", (13, 21)),
            ("12345678 (Employee ID)", (0, 8)),
            ("12345678 Employee ID", (0, 8)),
            ("\u{1F600} Employee ID: EMP123456", (18, 27)),
        ];

        for (text, span) in cases {
            assert_eq!(spans(&detector(), text), [span], "{text}");
        }
    }

    /// From `test/hr-identifier.test.ts`.
    #[test]
    fn rejects_bad_format_or_context() {
        let cases = [
            "Employee ID: 123",
            "Employee ID: EMP12345678901234",
            "Reference: EMP123456",
            "EMP123456",
            "myEmployee ID: EMP123456",
            "Employee IDX: EMP123456",
            "Employee ID:\nEMP123456",
            "Employee ID:         EMP123456",
            "EMP123456(Employee ID)",
            "EMP123456 (Employee ID",
            "EMP123456x (Employee ID)",
            "Employee ID: EMP123456_",
            "_Employee ID: EMP123456",
            "Employee ID: EMP123456\u{301}",
            "xEMP123456",
        ];

        for text in cases {
            assert!(spans(&detector(), text).is_empty(), "{text}");
        }
    }

    #[test]
    fn prefix_is_at_most_three_letters() {
        // Leftmost-first: the match starts at the fourth letter, which is adjacent.
        assert!(spans(&detector(), "Employee ID: ABCD1234").is_empty());
        assert_eq!(
            values(
                &detector(),
                "Employee ID: EMP123456 and Payroll No: PR123456789"
            ),
            ["EMP123456", "PR123456789"]
        );
    }
}
