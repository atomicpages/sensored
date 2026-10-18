//! Payment gateway token and merchant/terminal ids. Mirrors
//! `detectors/financial/payment-gateway-id.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};
use crate::text::JS_SPACE_CLASS;

const LABELS: &str = "(?:Stripe|Payment|Gateway|Token|Customer|Subscription|Merchant|Terminal|POS)";
const WINDOW: (usize, usize) = (40, 20);

/// TS compiles this with `gi` and no `u`, so case folding is ASCII only: the
/// keywords fold with `(?i-u)` (keeping `ſ` from matching `s`) and the
/// letter classes are spelled out. `\s` is JS whitespace.
fn pattern() -> Regex {
    regex(&format!(
        "(?i-u:tok|card|pm|src)_[a-zA-Z0-9]{{24,}}\
         |(?i-u:cus)_[a-zA-Z0-9]{{14,}}\
         |(?i-u:sub)_[a-zA-Z0-9]{{14,}}\
         |(?i-u:MERCHANT|MID)[-{s}]?(?i-u:ID|NO|NUM(?:BER)?)?[-{s}]?[:#]?[{s}]*[A-Za-z0-9]{{8,20}}\
         |(?i-u:TERMINAL|TID|POS)[-{s}]?(?i-u:ID|NO|NUM(?:BER)?)?[-{s}]?[:#]?[{s}]*[A-Za-z0-9]{{6,16}}",
        s = JS_SPACE_CLASS,
    ))
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "payment_gateway_id",
        entity_type: "payment_gateway_id",
        replacement: "[PAYMENT_GATEWAY_ID]",
        pattern: LazyLock::new(pattern),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Stripe",
            "Payment",
            "Gateway",
            "Token",
            "Customer",
            "Subscription",
            "Merchant",
            "Terminal",
            "POS",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(50, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::spans;
    use super::*;

    /// From `test/payment-gateway-id.test.ts` (UTF-16 spans; all ASCII).
    #[test]
    fn detects_gateway_ids() {
        let detector = detector();

        for (text, start, end) in [
            ("Stripe token: tok_1234567890abcdefghijklmnopqrstuv", 14, 50),
            ("Payment card_1234567890abcdefghijklmnopqrstuv", 8, 45),
            ("Gateway pm_1234567890abcdefghijklmnopqrstuv", 8, 43),
            ("Token src_1234567890abcdefghijklmnopqrstuv", 6, 42),
            ("Stripe customer: cus_1234567890abcd", 17, 35),
            ("Payment subscription: sub_1234567890abcd", 22, 40),
            ("Payment MERCHANT ID: ABC123456789", 8, 33),
            ("Gateway MERCHANT NO: 12345678ABCD", 8, 33),
            ("Payment MID: ABC123456789", 8, 25),
            ("Gateway TERMINAL ID: ABC123456", 8, 30),
            ("Payment TID: ABC123456", 8, 22),
            ("Gateway POS ID: ABC123456", 8, 25),
            ("Payment merchant id: abc123456789", 8, 33),
            ("Payment MID:\u{A0}ABC123456789", 8, 26),
        ] {
            assert_eq!(spans(&detector, text), [(start, end)], "{text}");
        }
    }

    /// From `test/payment-gateway-id.test.ts`.
    #[test]
    fn rejects_short_or_unlabelled() {
        let detector = detector();

        for text in [
            "tok_1234567890abcdefghijklmnopqrstuv",
            "Reference: tok_1234567890abcdefghijklmnopqrstuv",
            "Stripe token: tok_123",
            "Stripe customer: cus_123",
            "Stripe subscription: sub_123",
            "Payment MERCHANT ID: ABC123",
            "Gateway TERMINAL ID: ABC12",
            // ASCII folding only: the long s is not `s`.
            "Stripe customer: cu\u{17F}_1234567890abcd",
        ] {
            assert!(spans(&detector, text).is_empty(), "{text}");
        }
    }
}
