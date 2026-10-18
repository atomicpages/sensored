//! Investment, pension, trading and loan account numbers. Mirrors
//! `detectors/financial/investment-account.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};
use crate::text::JS_SPACE_CLASS;

const LABELS: &str = "(?:ISA|SIPP|Invest|Pension|401K|IRA|Account|Fund|Trading|Brokerage|Stock|Loan|Mortgage|Credit)";
const WINDOW: (usize, usize) = (40, 20);

/// TS compiles this with `gi` and no `u`, so case folding is ASCII only: the
/// keywords fold with `(?i-u)` (keeping the Kelvin sign from matching `K`)
/// and the id class is spelled out. `\s` is JS whitespace.
fn pattern() -> Regex {
    regex(&format!(
        "(?i-u:ISA|SIPP|INV(?:ESTMENT)?|PENSION|401K|IRA)[-{s}]*{account}?[-{s}]*{number}?\
         [-{s}.:#]*{id}(?:{id}[{s}./-]?){{5,18}}{id}\
         |(?i-u:TRADING|BROKERAGE|STOCK)[-{s}]?{account}?[-{s}]?{number}?[-{s}]?[:#]?[{s}]*{id}{{6,14}}\
         |(?i-u:LOAN|MORTGAGE|CREDIT)[-{s}]?{account}?[-{s}]?{number}?[-{s}]?[:#]?[{s}]*{id}{{6,16}}",
        s = JS_SPACE_CLASS,
        account = "(?i-u:ACCOUNT|ACCT|A/C)",
        number = "(?i-u:NO|NUM(?:BER)?)",
        id = "[A-Za-z0-9]",
    ))
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "investment_account",
        entity_type: "investment_account",
        replacement: "[INVESTMENT_ACCOUNT]",
        pattern: LazyLock::new(pattern),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "ISA",
            "SIPP",
            "Invest",
            "Pension",
            "401K",
            "IRA",
            "Account",
            "Fund",
            "Trading",
            "Brokerage",
            "Stock",
            "Loan",
            "Mortgage",
            "Credit",
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

    /// From `test/investment-account.test.ts` (UTF-16 spans; all ASCII).
    #[test]
    fn detects_accounts() {
        let detector = detector();

        for (text, start, end) in [
            ("Account ISA NO: AB123456", 8, 24),
            ("Fund SIPP NO: 123456AB", 5, 22),
            ("Account INV NO: AB123456", 8, 24),
            ("Fund INVESTMENT NO: 123456AB", 5, 28),
            ("Account PENSION NO: AB123456", 8, 28),
            ("Fund 401K NO: 123456AB", 5, 22),
            ("Account IRA NO: AB123456", 8, 24),
            ("Fund TRADING NO: AB123456", 5, 25),
            ("Account BROKERAGE NO: 123456AB", 8, 30),
            ("Fund STOCK NO: AB123456", 5, 23),
            ("Account LOAN NO: AB123456", 8, 25),
            ("Fund MORTGAGE NO: 123456AB", 5, 26),
            ("Account CREDIT NO: AB123456", 8, 27),
            ("Account ISA NO: AB12345", 8, 23),
            ("Fund TRADING NO: ABCDEFGHIJKLMN", 5, 31),
            ("Account LOAN NO: ABCDEFGHIJKLMNOP", 8, 33),
            ("Fund ISA A/C: AB 12-34/56", 5, 25),
        ] {
            assert_eq!(spans(&detector, text), [(start, end)], "{text}");
        }
    }

    /// From `test/investment-account.test.ts`.
    #[test]
    fn rejects_short_long_or_unlabelled() {
        let detector = detector();

        for text in [
            "AB123456",
            "Reference: AB123456",
            "Account ISA NO: AB1",
            "myAccount ISA NO: AB123456",
            "Fund TRADING NO: AB1",
            "Account LOAN NO: AB1",
            "Fund TRADING NO: ABCDEFGHIJKLMNO",
            "Account ISA NO: ABCDEFGHIJKLMNOPQRSTUV",
            "Account ISA NO: _AB123456",
            "xAccount ISA NO: AB123456",
            // ASCII folding only: the Kelvin sign is not `K`.
            "Fund 401\u{212A} NO: 123456AB",
        ] {
            assert!(spans(&detector, text).is_empty(), "{text}");
        }
    }
}
