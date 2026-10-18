//! Transaction, wire, statement and payment references. Mirrors
//! `detectors/financial/financial-reference.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};
use crate::text::JS_SPACE_CLASS;

const LABELS: &str =
    "(?:Transaction|TXN|Wire|Transfer|Remittance|Statement|Payment|Financial|Banking)";
const WINDOW: (usize, usize) = (40, 20);

/// TS compiles this with `gi` and no `u`, so case folding is ASCII only: the
/// keywords fold with `(?i-u)` and the id class is spelled out. `\s` is JS
/// whitespace.
fn pattern() -> Regex {
    regex(&format!(
        "(?i-u:TXN|TX|TRANS(?:ACTION)?)[-{s}]?(?i-u:ID|NO|NUM(?:BER)?|REF)?[-{s}]?[:#]?[{s}]*{id}{{8,20}}\
         |(?i-u:WIRE|TRANSFER|REMITTANCE)[-{s}]?(?i-u:REF(?:ERENCE)?|NO|NUM(?:BER)?|ID)?[-{s}]?[:#]?[{s}]*{id}{{8,20}}\
         |(?i-u:STATEMENT|STMT)[-{s}]?(?i-u:REF(?:ERENCE)?|NO|NUM(?:BER)?|ID)?[-{s}]?[:#]?[{s}]*{id}{{6,15}}\
         |(?i-u:PAYMENT|PAY)[-{s}]?(?i-u:REF(?:ERENCE)?|NO|NUM(?:BER)?|ID)?[-{s}]?[:#]?[{s}]*{id}{{8,20}}",
        s = JS_SPACE_CLASS,
        id = "[A-Za-z0-9]",
    ))
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "financial_reference",
        entity_type: "financial_reference",
        replacement: "[FINANCIAL_REFERENCE]",
        pattern: LazyLock::new(pattern),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Transaction",
            "TXN",
            "Wire",
            "Transfer",
            "Remittance",
            "Statement",
            "Payment",
            "Financial",
            "Banking",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(30, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::spans;
    use super::*;

    /// From `test/financial-reference.test.ts` (UTF-16 spans; all ASCII).
    #[test]
    fn detects_references() {
        let detector = detector();

        for (text, start, end) in [
            ("Financial TXN ID: ABC123456789", 10, 30),
            ("Banking TX NO: A1B2C3D4E5", 8, 25),
            ("Financial Transaction REF: XY9876543210", 10, 39),
            ("Banking WIRE REF: ABC123456789", 8, 30),
            ("Financial TRANSFER NO: 12345678ABCD", 10, 35),
            ("Banking REMITTANCE ID: REF123456789", 8, 35),
            ("Financial STATEMENT REF: ABC123456", 10, 34),
            ("Banking STMT NO: 123456AB", 8, 25),
            ("Financial PAYMENT REF: ABC123456789", 10, 35),
            ("Banking PAY ID: 12345678AB", 8, 26),
            ("Financial TXN:ABC123456789", 10, 26),
            ("Banking TXN# ABC123456789", 8, 25),
            ("Financial TXN-REF: ABC123456789", 10, 31),
            ("Financial TXN ID: ABCDEFGHIJKLMNOPQRST", 10, 38),
            ("Banking STMT NO: ABC123", 8, 23),
        ] {
            assert_eq!(spans(&detector, text), [(start, end)], "{text}");
        }
    }

    /// From `test/financial-reference.test.ts`.
    #[test]
    fn rejects_short_long_or_unlabelled() {
        let detector = detector();

        for text in [
            "ABC123456789",
            "Reference: ABC123456789",
            "Financial TXN ID: ABC123",
            "Banking TXN: 12345",
            "myFinancial TXN ID: ABC123456789",
            "Banking WIRE REF: ABC123",
            "Financial STATEMENT REF: ABC12",
            "Banking PAY REF: ABC123",
            "Banking STMT NO: ABCDEFGHIJKLMNOP",
            "Financial TXN ID: ABCDEFGHIJKLMNOPQRSTU",
            "Financial TXN ID: _ABC123456789",
            "xFinancial TXN ID: ABC123456789",
        ] {
            assert!(spans(&detector, text).is_empty(), "{text}");
        }
    }
}
