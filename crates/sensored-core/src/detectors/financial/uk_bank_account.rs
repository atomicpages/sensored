//! UK bank account number. Mirrors `detectors/financial/uk-bank-account.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:account[- ]?(?:no|number)|acct[- ]?(?:no|number)|bank[- ]?account)";
const WINDOW: (usize, usize) = (40, 40);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "uk_bank_account",
        entity_type: "uk_bank_account",
        replacement: "[UK_BANK_ACCOUNT]",
        pattern: LazyLock::new(|| regex(r"[0-9]{8}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "account no",
            "account number",
            "acct no",
            "acct number",
            "bank account",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(8, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/uk-bank-account.test.ts`.
    #[test]
    fn detects_account_numbers() {
        let detector = detector();

        for (text, expected) in [
            ("account number: 12345678", "12345678"),
            ("account no: 12345678", "12345678"),
            ("Account Number 12345678", "12345678"),
            ("acct no: 87654321", "87654321"),
            ("acct number: 12345678", "12345678"),
            ("bank account: 12345678", "12345678"),
            ("Account Number: 12345678 done", "12345678"),
            ("12345678 (bank account)", "12345678"),
        ] {
            assert_eq!(values(&detector, text), [expected], "{text}");
        }
    }

    /// From `test/uk-bank-account.test.ts`.
    #[test]
    fn rejects_without_context_or_embedded() {
        let detector = detector();

        for text in [
            "12345678",
            "account: 12345678",
            "account number: 1234567",
            "account number: 123456789",
            "account number: x12345678",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
