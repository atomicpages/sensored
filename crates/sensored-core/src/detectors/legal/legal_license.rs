//! Mirrors `detectors/legal/legal-license.ts`.

use std::sync::LazyLock;

use super::{has_ascii_digit, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = r"(?:Bar|Attorney|Lawyer|Notary|Notarial|Court Reporter|CSR|RPR|License|Commission|Legal|Law Firm)(?:[- \t]{1,8}(?:No|License|Registration|Commission)\.?)?";
const WINDOW: (usize, usize) = (40, 20);

fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    if !has_ascii_digit(candidate) {
        return None;
    }

    Some(&["legal_license.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "legal_license",
        entity_type: "legal_license",
        replacement: "[LEGAL_LICENSE]",
        // TS `/[A-Z0-9][-A-Z0-9]{4,11}/gi`, ASCII folding spelled out.
        pattern: LazyLock::new(|| regex(r"[A-Za-z0-9][-A-Za-z0-9]{4,11}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Bar",
            "Bar No.",
            "Bar No",
            "Bar License.",
            "Bar License",
            "Bar Registration.",
            "Bar Registration",
            "Bar Commission.",
            "Bar Commission",
            "Attorney",
            "Attorney No.",
            "Attorney No",
            "Attorney License.",
            "Attorney License",
            "Attorney Registration.",
            "Attorney Registration",
            "Attorney Commission.",
            "Attorney Commission",
            "Lawyer",
            "Lawyer No.",
            "Lawyer No",
            "Lawyer License.",
            "Lawyer License",
            "Lawyer Registration.",
            "Lawyer Registration",
            "Lawyer Commission.",
            "Lawyer Commission",
            "Notary",
            "Notary No.",
            "Notary No",
            "Notary License.",
            "Notary License",
            "Notary Registration.",
            "Notary Registration",
            "Notary Commission.",
            "Notary Commission",
            "Notarial",
            "Notarial No.",
            "Notarial No",
            "Notarial License.",
            "Notarial License",
            "Notarial Registration.",
            "Notarial Registration",
            "Notarial Commission.",
            "Notarial Commission",
            "Court Reporter",
            "Court Reporter No.",
            "Court Reporter No",
            "Court Reporter License.",
            "Court Reporter License",
            "Court Reporter Registration.",
            "Court Reporter Registration",
            "Court Reporter Commission.",
            "Court Reporter Commission",
            "CSR",
            "CSR No.",
            "CSR No",
            "CSR License.",
            "CSR License",
            "CSR Registration.",
            "CSR Registration",
            "CSR Commission.",
            "CSR Commission",
            "RPR",
            "RPR No.",
            "RPR No",
            "RPR License.",
            "RPR License",
            "RPR Registration.",
            "RPR Registration",
            "RPR Commission.",
            "RPR Commission",
            "License",
            "License No.",
            "License No",
            "License License.",
            "License License",
            "License Registration.",
            "License Registration",
            "License Commission.",
            "License Commission",
            "Commission",
            "Commission No.",
            "Commission No",
            "Commission License.",
            "Commission License",
            "Commission Registration.",
            "Commission Registration",
            "Commission Commission.",
            "Commission Commission",
            "Legal",
            "Legal No.",
            "Legal No",
            "Legal License.",
            "Legal License",
            "Legal Registration.",
            "Legal Registration",
            "Legal Commission.",
            "Legal Commission",
            "Law Firm",
            "Law Firm No.",
            "Law Firm No",
            "Law Firm License.",
            "Law Firm License",
            "Law Firm Registration.",
            "Law Firm Registration",
            "Law Firm Commission.",
            "Law Firm Commission",
        ],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(12, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/legal-license.test.ts`.
    #[test]
    fn detects_licenses_with_context() {
        let cases = [
            ("Bar No: ABC12345", "ABC12345"),
            ("Bar License: ABC12345", "ABC12345"),
            ("Notary Commission: ABC123456789", "ABC123456789"),
            ("Court Reporter No: AB123456", "AB123456"),
            ("RPR No: ABC12345678", "ABC12345678"),
            ("BAR# ABC12345", "ABC12345"),
            ("Law Firm Bar: ABC123456", "ABC123456"),
            ("bar no: abc12345", "abc12345"),
            ("ABC12345 (Bar)", "ABC12345"),
            ("Bar No: A1234", "A1234"),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&detector(), input), [expected], "{input}");
        }
    }

    /// From `test/legal-license.test.ts`.
    #[test]
    fn rejects_without_context_or_format() {
        let cases = [
            "Reference: ABC12345",
            "ABC12345",
            "myBar: ABC12345",
            "Barx: ABC12345",
            "Bar:\nABC12345",
            "Bar:         ABC12345",
            "Bar No: ABCDEFGHI",
            "ABC12345 (Reference)",
            "ABC12345(Bar)",
            "Bar No: A123",
            "Bar No: ABC1234567890",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }
}
