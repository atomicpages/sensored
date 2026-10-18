//! Magnetic stripe tracks, CVV and expiry. Mirrors `detectors/financial/card-data.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};
use crate::text::JS_SPACE_CLASS;

const LABELS: &str =
    "(?:Card|Payment|Credit|Debit|Visa|Mastercard|Amex|CVV|CVC|Expiry|Track|Magnetic|Stripe)";
const WINDOW: (usize, usize) = (40, 20);

/// TS compiles this with `gi` and no `u`, so case folding is ASCII only: the
/// letters fold with `(?i-u)`. `\s` is JS whitespace; the negated track
/// classes match any character, newlines included, as in JS.
fn pattern() -> Regex {
    regex(&format!(
        "%(?i-u:B)[0-9]{{13,19}}\\^[^\\^]+\\^[0-9]{{4}}[0-9]{{3}}[^?]+\\?\
         |;[0-9]{{13,19}}=[0-9]{{4}}[0-9]{{3}}[^?]+\\?\
         |(?i-u:CVV|CVC|CVV2|CID|CSC)[:{s}]+[0-9]{{3,4}}\
         |(?:(?i-u:EXP(?:IRY|IRATION)?)|(?i-u:VALID)[{s}]+(?i-u:THRU))[:{s}]+[0-9]{{2}}[/-][0-9]{{2,4}}",
        s = JS_SPACE_CLASS,
    ))
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "card_data",
        entity_type: "card_data",
        replacement: "[CARD_DATA]",
        pattern: LazyLock::new(pattern),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Card",
            "Payment",
            "Credit",
            "Debit",
            "Visa",
            "Mastercard",
            "Amex",
            "CVV",
            "CVC",
            "Expiry",
            "Track",
            "Magnetic",
            "Stripe",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(100, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{spans, values};
    use super::*;

    /// From `test/card-data.test.ts` (UTF-16 spans; all ASCII).
    #[test]
    fn detects_cvv_and_expiry() {
        let detector = detector();

        for (text, start, end) in [
            ("Card CVV: 123", 5, 13),
            ("Payment CVC: 4567", 8, 17),
            ("Credit CVV2: 123", 7, 16),
            ("Debit CID: 999", 6, 14),
            ("Visa CSC: 1234", 5, 14),
            ("Card EXP: 12/25", 5, 15),
            ("Payment EXPIRY: 12-2025", 8, 23),
            ("Credit EXPIRATION: 06/26", 7, 24),
            ("Card VALID THRU: 11/27", 5, 22),
            ("card cvv:\u{A0}123", 5, 14),
        ] {
            assert_eq!(spans(&detector, text), [(start, end)], "{text}");
        }
    }

    #[test]
    fn detects_tracks() {
        let detector = detector();

        let track1 = "%B4111111111111111^DOE/JOHN^2512101000000000?";
        let track2 = ";4111111111111111=25121010000000000?";

        assert_eq!(values(&detector, &format!("Track: {track1}")), [track1]);
        assert_eq!(values(&detector, &format!("Track: {track2}")), [track2]);

        // The name field may hold any character but `^`, newlines included.
        let multiline = "%b4111111111111^DOE\nJOHN^2512101x?";

        assert_eq!(
            values(&detector, &format!("Magnetic {multiline}")),
            [multiline]
        );
    }

    /// From `test/card-data.test.ts`.
    #[test]
    fn rejects_bad_shapes() {
        let detector = detector();

        for text in [
            "CVV: 12",
            "CVV: 12345",
            "EXP: 1/25",
            "EXP: 123/25",
            "123",
            "Reference: CVV: 123",
            "Card xCVV: 123",
            "Card CVV: 123a",
            "Card CVV: 123_",
            "",
            "Card",
        ] {
            assert!(spans(&detector, text).is_empty(), "{text}");
        }
    }
}
