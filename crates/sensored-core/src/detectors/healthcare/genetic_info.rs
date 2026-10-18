//! Mirrors `detectors/healthcare/genetic-info.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Genetic|Gene|SNP|Marker|Genome|DNA|Variant|Allele|Sequence|Nucleotide)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "genetic_info",
        entity_type: "genetic_info",
        replacement: "[GENETIC_INFO]",
        // TS `/rs\d{6,10}|[ATCG]{20,}/gi`, ASCII folding spelled out.
        pattern: LazyLock::new(|| regex(r"[Rr][Ss][0-9]{6,10}|[ATCGatcg]{20,}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Genetic",
            "Gene",
            "SNP",
            "Marker",
            "Genome",
            "DNA",
            "Variant",
            "Allele",
            "Sequence",
            "Nucleotide",
        ],
        window: WINDOW,
        validate: None,
        // TS quirk: the DNA alternative is unbounded, but the stream bound is 100.
        stream: StreamMeta::new(100, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    const DNA20: &str = "ATCGATCGATCGATCGATCG";

    /// From `test/genetic-info.test.ts`.
    #[test]
    fn detects_markers_with_context() {
        let dna25 = format!("{DNA20}ATCGA");

        let cases = [
            ("Genetic marker: rs123456".to_owned(), "rs123456"),
            ("Gene: rs12345678".to_owned(), "rs12345678"),
            ("DNA: rs1234567890".to_owned(), "rs1234567890"),
            (format!("SNP: {DNA20}"), DNA20),
            (format!("Genome sequence: {dna25}"), dna25.as_str()),
            ("Allele: rs987654321".to_owned(), "rs987654321"),
            (
                format!("dna: {}", DNA20.to_lowercase()),
                "atcgatcgatcgatcgatcg",
            ),
            ("rs123456 (Genetic)".to_owned(), "rs123456"),
        ];

        for (input, expected) in &cases {
            assert_eq!(values(&detector(), input), [*expected], "{input}");
        }
    }

    /// From `test/genetic-info.test.ts`.
    #[test]
    fn rejects_without_context_or_format() {
        let cases = [
            "rs123456",
            DNA20,
            "Reference: rs123456",
            "Genetic marker: rs12345",
            "DNA: ATCGATCGATCGATCG",
            "Genetic marker: xrs123456",
            "Genetic marker: rs12345678901",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }

    #[test]
    fn multiple_markers() {
        assert_eq!(
            values(&detector(), "Genetic marker: rs123456 and Gene: rs789012"),
            ["rs123456", "rs789012"]
        );
    }

    #[test]
    fn case_folding_is_ascii_only() {
        assert!(values(&detector(), "Gene: r\u{17F}123456").is_empty());
    }
}
