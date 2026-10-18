//! Generic passport numbers near a label. Mirrors `identity/passport.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = r"(?:Passport Number|Passport No\.|Passport)";
const WINDOW: (usize, usize) = (30, 20);

/// The TS pattern has the `gi` flags without `u`: ASCII letters only.
/// Alternation order is kept; leftmost-first prefers 2+7 over 2+6.
const PATTERN: &str = r"[A-Za-z]{2}[0-9]{7}|[A-Za-z]{2}[0-9]{6}|[0-9]{9}";

pub fn detector() -> ContextDetector {
    ContextDetector {
        id: "passport",
        entity_type: "passport",
        replacement: "[PASSPORT]",
        pattern: LazyLock::new(|| Regex::new(PATTERN).expect("valid pattern")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Passport Number", "Passport No.", "Passport"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(9, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detectors::identity::test_support::{spans, values};

    /// From `test/passport.test.ts`.
    #[test]
    fn detects_labelled_passports() {
        let cases = [
            ("Passport: 123456789", "123456789"),
            ("Passport No.: AB123456", "AB123456"),
            ("Passport Number: AB1234567", "AB1234567"),
            ("passport: ab1234567", "ab1234567"),
            ("PASSPORT: AB123456", "AB123456"),
            ("before Passport: 123456789 after", "123456789"),
            ("Passport: 123456789.", "123456789"),
            ("(Passport: 123456789)", "123456789"),
        ];

        for (text, value) in cases {
            assert_eq!(values(&detector(), text), [value], "{text}");
        }

        assert_eq!(
            spans(&detector(), "\u{1F600} Passport: 123456789"),
            [(15, 24)]
        );
    }

    /// From `test/passport.test.ts`.
    #[test]
    fn rejects_bad_format_or_context() {
        let cases = [
            "123456789",
            "AB123456",
            "My number is 123456789",
            "Passport: 12345678",
            "Passport: AB12345",
            "Passport: AB12345678",
            "Passport: 1234567890",
            "Passport: x123456789",
            "Passport: 123456789_",
        ];

        for text in cases {
            assert!(spans(&detector(), text).is_empty(), "{text}");
        }
    }
}
