//! Mirrors `detectors/legal/legal-reference.ts`.

use std::sync::LazyLock;

use super::{has_digit, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = r"(?:Matter|Engagement|Client|Settlement|Agreement|Retainer|NDA|Confidentiality|Non-Disclosure|Contract|CNTR|Legal|Law Firm|Attorney|Counsel)(?:[- \t]{1,8}(?:No|ID|Agreement)\.?)?";
const WINDOW: (usize, usize) = (40, 20);

fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    if !has_digit(candidate) {
        return None;
    }

    Some(&["legal_reference.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "legal_reference",
        entity_type: "legal_reference",
        replacement: "[LEGAL_REFERENCE]",
        // TS `/[A-Z0-9]{6,15}/gi`, ASCII folding spelled out.
        pattern: LazyLock::new(|| regex(r"[A-Za-z0-9]{6,15}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Matter",
            "Matter No.",
            "Matter No",
            "Matter ID.",
            "Matter ID",
            "Matter Agreement.",
            "Matter Agreement",
            "Engagement",
            "Engagement No.",
            "Engagement No",
            "Engagement ID.",
            "Engagement ID",
            "Engagement Agreement.",
            "Engagement Agreement",
            "Client",
            "Client No.",
            "Client No",
            "Client ID.",
            "Client ID",
            "Client Agreement.",
            "Client Agreement",
            "Settlement",
            "Settlement No.",
            "Settlement No",
            "Settlement ID.",
            "Settlement ID",
            "Settlement Agreement.",
            "Settlement Agreement",
            "Agreement",
            "Agreement No.",
            "Agreement No",
            "Agreement ID.",
            "Agreement ID",
            "Agreement Agreement.",
            "Agreement Agreement",
            "Retainer",
            "Retainer No.",
            "Retainer No",
            "Retainer ID.",
            "Retainer ID",
            "Retainer Agreement.",
            "Retainer Agreement",
            "NDA",
            "NDA No.",
            "NDA No",
            "NDA ID.",
            "NDA ID",
            "NDA Agreement.",
            "NDA Agreement",
            "Confidentiality",
            "Confidentiality No.",
            "Confidentiality No",
            "Confidentiality ID.",
            "Confidentiality ID",
            "Confidentiality Agreement.",
            "Confidentiality Agreement",
            "Non-Disclosure",
            "Non-Disclosure No.",
            "Non-Disclosure No",
            "Non-Disclosure ID.",
            "Non-Disclosure ID",
            "Non-Disclosure Agreement.",
            "Non-Disclosure Agreement",
            "Contract",
            "Contract No.",
            "Contract No",
            "Contract ID.",
            "Contract ID",
            "Contract Agreement.",
            "Contract Agreement",
            "CNTR",
            "CNTR No.",
            "CNTR No",
            "CNTR ID.",
            "CNTR ID",
            "CNTR Agreement.",
            "CNTR Agreement",
            "Legal",
            "Legal No.",
            "Legal No",
            "Legal ID.",
            "Legal ID",
            "Legal Agreement.",
            "Legal Agreement",
            "Law Firm",
            "Law Firm No.",
            "Law Firm No",
            "Law Firm ID.",
            "Law Firm ID",
            "Law Firm Agreement.",
            "Law Firm Agreement",
            "Attorney",
            "Attorney No.",
            "Attorney No",
            "Attorney ID.",
            "Attorney ID",
            "Attorney Agreement.",
            "Attorney Agreement",
            "Counsel",
            "Counsel No.",
            "Counsel No",
            "Counsel ID.",
            "Counsel ID",
            "Counsel Agreement.",
            "Counsel Agreement",
        ],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(15, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/legal-reference.test.ts`.
    #[test]
    fn detects_references_with_context() {
        let cases = [
            ("Matter No: ABC123456", "ABC123456"),
            ("Client Matter No: ABC123456", "ABC123456"),
            ("NDA Agreement No: ABC123456789", "ABC123456789"),
            ("Non-Disclosure No: ABC123456789", "ABC123456789"),
            ("CNTR No: 12345678", "12345678"),
            ("CNTR-NO: 12345678", "12345678"),
            ("MATTER# ABC123456", "ABC123456"),
            ("Law Firm Matter: ABC123456789", "ABC123456789"),
            ("matter no: abc123456", "abc123456"),
            ("ABC123456 (Matter)", "ABC123456"),
            ("Matter No: A12345", "A12345"),
            ("Matter No: ABC123456789012", "ABC123456789012"),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&detector(), input), [expected], "{input}");
        }
    }

    /// From `test/legal-reference.test.ts`.
    #[test]
    fn rejects_without_context_or_format() {
        let cases = [
            "Reference: ABC123456",
            "ABC123456",
            "myMatter: ABC123456",
            "Matterx: ABC123456",
            "Matter:\nABC123456",
            "Matter:         ABC123456",
            "Matter No: ABCDEFGHI",
            "ABC123456 (Reference)",
            "ABC123456(Matter)",
            "Matter No: A1234",
            "Matter No: ABC1234567890123",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }

    #[test]
    fn case_folding_is_ascii_only() {
        assert!(values(&detector(), "Matter No: \u{212A}BC123456").is_empty());
    }
}
