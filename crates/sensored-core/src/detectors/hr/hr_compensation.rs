//! Salary amounts and benefit plan numbers. Mirrors `hr/hr-compensation.ts`.
//!
//! Two patterns share one context matcher: amounts first, then plan IDs. A
//! span both patterns find is reported once, in amount order, as in TS.

use std::collections::HashSet;
use std::sync::LazyLock;

use regex::Regex;

use super::{has_ascii_digit, regex};
use crate::detector::{
    ContextHint, ContextMatcher, Detector, HintPosition, HintWindow, Input, StreamMeta,
    is_adjacent_forbidden, push_aligned,
};
use crate::text::JS_SPACE_CLASS;
use crate::types::Detection;

const ID: &str = "hr_compensation";

const LEFT_CONTEXT: usize = 40;
const RIGHT_CONTEXT: usize = 20;

const LABELS: &str = "(?:Salary|Compensation|Pay|Wage|Earning|Benefits Plan No|Insurance Plan ID|Health-Plan No|401K Account No|403B No|IRA No|Retirement Account No|Pension No)";

const LABEL_STRINGS: &[&str] = &[
    "Salary",
    "Compensation",
    "Pay",
    "Wage",
    "Earning",
    "Benefits Plan No",
    "Insurance Plan ID",
    "Health-Plan No",
    "401K Account No",
    "403B No",
    "IRA No",
    "Retirement Account No",
    "Pension No",
];

const REASONS: [&str; 2] = ["hr_compensation.format", "hr_compensation.context"];

/// `/(?:[$£€¥]\s?)?\d[\d,]*(?:\.\d{1,2})?/gi`: no letters, so `i` is moot.
static AMOUNT: LazyLock<Regex> = LazyLock::new(|| {
    regex(&format!(
        r"(?:[$£€¥][{JS_SPACE_CLASS}]?)?[0-9][0-9,]*(?:\.[0-9]{{1,2}})?"
    ))
});

/// `/[A-Z0-9]{6,16}/gi` without `u`: ASCII letters in either case.
static PLAN_ID: LazyLock<Regex> = LazyLock::new(|| regex(r"[A-Za-z0-9]{6,16}"));

static CONTEXT: LazyLock<ContextMatcher> =
    LazyLock::new(|| ContextMatcher::new(LABELS, LEFT_CONTEXT, RIGHT_CONTEXT));

pub struct HrCompensation;

impl Detector for HrCompensation {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[HR_COMPENSATION]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(30, LEFT_CONTEXT, RIGHT_CONTEXT))
    }

    fn context_hint(&self) -> Option<ContextHint> {
        Some(ContextHint {
            required: true,
            labels: LABEL_STRINGS
                .iter()
                .map(|label| (*label).to_owned())
                .collect(),
            position: HintPosition::Both,
            window: HintWindow {
                before: LEFT_CONTEXT,
                after: RIGHT_CONTEXT,
            },
            instructions: None,
        })
    }

    fn detect_in(&self, input: &Input<'_>, out: &mut Vec<Detection>) {
        let text = input.text();

        let context = CONTEXT.scan(input);

        // Both patterns need a label nearby.
        if !context.any_label() {
            return;
        }

        let amounts = AMOUNT.find_iter(text);

        // TS tests for a digit after the adjacency check; both are pure.
        let plan_ids = PLAN_ID
            .find_iter(text)
            .filter(|found| has_ascii_digit(found.as_str()));

        let mut seen = HashSet::new();
        let mut candidates = Vec::new();

        for found in amounts.chain(plan_ids) {
            let (start, end) = (found.start(), found.end());

            if is_adjacent_forbidden(text, start, end) {
                continue;
            }

            if !context.has_context(start, end) {
                continue;
            }

            if !seen.insert((start, end)) {
                continue;
            }

            candidates.push(Detection {
                start,
                end,
                rule_id: ID.to_owned(),
                entity_type: ID.to_owned(),
                reasons: REASONS.iter().map(|reason| (*reason).to_owned()).collect(),
            });
        }

        push_aligned(text, candidates, out);
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::spans;
    use super::*;

    /// From `test/hr-compensation.test.ts`, with UTF-16 offsets as bytes.
    #[test]
    fn detects_amounts_and_plan_ids() {
        let cases = [
            ("Salary: $50,000.00", (8, 18)),
            ("Compensation: $75,000", (14, 21)),
            ("Wage: $15.50", (6, 12)),
            ("Benefits Plan No: BP123456", (18, 26)),
            ("401K Account No: RET123456789012", (17, 32)),
            ("403B No: 403B12345678", (9, 21)),
            ("SALARY: $50,000.00", (8, 18)),
            ("Salary:$50,000.00", (7, 17)),
            ("Salary: $ 50,000.00", (8, 19)),
            // `£` and `€` are 1 UTF-16 unit but 2 and 3 bytes.
            ("Salary: £50,000.00", (8, 19)),
            ("Salary: €50,000.00", (8, 20)),
            ("Salary: ¥50000", (8, 15)),
            ("50000.00 (Salary)", (0, 8)),
            ("50000.00 Salary", (0, 8)),
            ("\u{1F600} Salary: $50,000.00", (13, 23)),
        ];

        for (text, span) in cases {
            assert_eq!(spans(&HrCompensation, text), [span], "{text}");
        }
    }

    /// From `test/hr-compensation.test.ts`.
    #[test]
    fn rejects_bad_context_or_adjacency() {
        let cases = [
            "Reference: $50,000.00",
            "$50,000.00",
            "mySalary: $50,000.00",
            "Salaryx: $50,000.00",
            "Salary:\n$50,000.00",
            "Salary:         $50,000.00",
            "$50,000.00(Salary)",
            "$50,000.00 (Salary",
            "$50,000.00x (Salary)",
            "Salary: $50,000.00_",
            "_Salary: $50,000.00",
            "Salary: $50,000.00\u{301}",
            "x$50,000.00",
            "$50,000.00x",
        ];

        for text in cases {
            assert!(spans(&HrCompensation, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn keeps_pattern_order_and_dedups_shared_spans() {
        assert_eq!(
            spans(
                &HrCompensation,
                "Salary: $50,000.00 and 401K Account No: RET123456789012"
            ),
            [(8, 18), (40, 55)]
        );

        // Both patterns match `123456`; it is reported once.
        assert_eq!(spans(&HrCompensation, "Salary: 123456"), [(8, 14)]);

        // Amounts come first even when a plan ID precedes them in the text.
        assert_eq!(
            spans(&HrCompensation, "Pension No: PN123456 Pay: $15"),
            [(26, 29), (12, 20)]
        );
    }

    #[test]
    fn js_space_after_currency() {
        // JS `\s` matches U+FEFF.
        assert_eq!(spans(&HrCompensation, "Pay: $\u{FEFF}15"), [(5, 11)]);
    }
}
