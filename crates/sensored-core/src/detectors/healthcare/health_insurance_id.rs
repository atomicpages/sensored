//! Mirrors `detectors/healthcare/health-insurance-id.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::JS_SPACE;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Insurance|Claim|Medical|Health|Policy|Plan|Beneficiary|Member)";
const WINDOW: (usize, usize) = (40, 20);

/// The TS pattern has the `i` flag but not `u`, so case folding is ASCII
/// only: the id class stays case-sensitive here, or `(?i)` would let the
/// Kelvin sign and long s match `K` and `S`. The keywords hold neither letter.
fn pattern() -> Regex {
    let id = "(?-i:[A-Za-z0-9])";

    let source = format!(
        "(?i)(?:CLAIM|CLM)[-{s}]?(?:NO|NUM(?:BER)?|REF|ID)?[-{s}]?[:#]?[{s}]*{id}{{8,16}}\
         |(?:HEALTH[-{s}]?PLAN|BENEFICIARY|MEMBER)[-{s}]?(?:NO|NUM(?:BER)?|ID)?[-{s}]?[:#]?[{s}]*{id}{{8,15}}",
        s = JS_SPACE,
    );

    Regex::new(&source).expect("valid pattern")
}

pub fn detector() -> ContextDetector {
    ContextDetector {
        id: "health_insurance_id",
        entity_type: "health_insurance_id",
        replacement: "[HEALTH_INSURANCE_ID]",
        pattern: LazyLock::new(pattern),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Insurance",
            "Claim",
            "Medical",
            "Health",
            "Policy",
            "Plan",
            "Beneficiary",
            "Member",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(30, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use crate::detector::Detector;

    use super::*;

    fn spans(text: &str) -> Vec<&str> {
        let mut out = Vec::new();
        detector().detect(text, &mut out);

        out.iter().map(|d| &text[d.start..d.end]).collect()
    }

    /// From `test/health-insurance-id.test.ts`.
    #[test]
    fn detects_ids_with_context() {
        let cases = [
            ("Insurance Claim NO: ABC12345", "Claim NO: ABC12345"),
            ("Medical CLM REF: XYZ98765", "CLM REF: XYZ98765"),
            (
                "Insurance Health Plan ID: MEMBER12345",
                "Health Plan ID: MEMBER12345",
            ),
            (
                "Policy Beneficiary ID: BENEF98765",
                "Beneficiary ID: BENEF98765",
            ),
            ("Insurance Claim ID: ABC12345DEF", "Claim ID: ABC12345DEF"),
            ("Insurance Member NO: ABC12345", "Member NO: ABC12345"),
            ("insurance claim no: abc12345", "claim no: abc12345"),
            ("Insurance Claim ABC12345", "Claim ABC12345"),
            ("Claim NO: ABC12345 (Insurance)", "Claim NO: ABC12345"),
        ];

        for (input, expected) in cases {
            assert_eq!(spans(input), [expected], "{input}");
        }
    }

    /// From `test/health-insurance-id.test.ts`.
    #[test]
    fn rejects_without_context_or_format() {
        let cases = [
            "Claim NO: ABC12345",
            "Reference: Claim NO: ABC12345",
            "Insurance Claim NO: ABC1234",
            "Insurance xClaim NO: ABC12345",
            "Insurance Claim NO: ABC12345DEFGHIJKL",
            "Insurance Health Plan ID: ABC12345DEFGHIJKL",
        ];

        for input in cases {
            assert!(spans(input).is_empty(), "{input}");
        }
    }

    #[test]
    fn multiple_ids() {
        assert_eq!(
            spans("Insurance Claim NO: ABC12345 and Policy Member ID: XYZ98765"),
            ["Claim NO: ABC12345", "Member ID: XYZ98765"]
        );
    }

    #[test]
    fn case_folding_is_ascii_only() {
        assert!(spans("Insurance Claim NO: \u{212A}BC12345").is_empty());
    }

    #[test]
    fn js_whitespace_includes_bom_but_not_nel() {
        assert_eq!(
            spans("Insurance Claim\u{FEFF}ABC12345"),
            ["Claim\u{FEFF}ABC12345"]
        );
        assert!(spans("Insurance Claim\u{85}ABC12345").is_empty());
    }
}
