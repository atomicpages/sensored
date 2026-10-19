//! Vehicle license plates near a label. Mirrors `identity/license-plate.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LEFT_CONTEXT: usize = 35;
const RIGHT_CONTEXT: usize = 20;

const LABELS: &str = r"(?:License Plate|Plate Number|Registration|Vehicle Registration|License Plate Number|Tag Number|License Plate No\.|Plate No\.)";

/// The TS pattern has the `gi` flags without `u`, so `[A-Z]` folds to ASCII
/// letters only; `(?i)` would also admit `ſ` and the Kelvin sign.
const PATTERN: &str = r"[A-Za-z]{2}[0-9]{2}[A-Za-z]{3}|[0-9]{2}[A-Za-z]{3}|[A-Za-z]{3}[0-9]{4}|[A-Za-z][0-9][A-Za-z]-?[0-9][A-Za-z][0-9]|[A-Za-z0-9]{2,8}";

/// Candidates are ASCII, so byte length equals the TS UTF-16 length.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    if !candidate.bytes().any(|byte| byte.is_ascii_digit()) {
        return None;
    }

    Some(&["license_plate.format"])
}

pub fn detector() -> ContextDetector {
    ContextDetector {
        id: "license_plate",
        entity_type: "license_plate",
        replacement: "[LICENSE_PLATE]",
        pattern: LazyLock::new(|| Regex::new(PATTERN).expect("valid pattern")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, LEFT_CONTEXT, RIGHT_CONTEXT)),
        labels: &[
            "License Plate",
            "Plate Number",
            "Registration",
            "Vehicle Registration",
            "License Plate Number",
            "Tag Number",
            "License Plate No.",
            "Plate No.",
        ],
        window: (LEFT_CONTEXT, RIGHT_CONTEXT),
        validate: Some(validate),
        stream: StreamMeta::new(15, LEFT_CONTEXT, RIGHT_CONTEXT),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detectors::identity::test_support::{spans, values};

    #[test]
    fn matches_labelled_plates() {
        let detector = detector();
        let cases = [
            ("License Plate: ABC123", "ABC123"),
            ("License Plate Number: AB12CD", "AB12CD"),
            ("License Plate No.: R8T9X", "R8T9X"),
            ("Plate No.: A1B2C3", "A1B2C3"),
            ("License Plate: AB12CDE", "AB12CDE"),
            ("License Plate: A1B-2C3", "A1B-2C3"),
            ("registration: xyz789", "xyz789"),
            ("A1B2C3 (Plate Number)", "A1B2C3"),
            ("License Plate: \t ABC123", "ABC123"),
        ];

        for (text, value) in cases {
            assert_eq!(values(&detector, text), [value], "{text}");
        }
    }

    #[test]
    fn rejects_unlabelled_or_invalid_candidates() {
        let detector = detector();
        let cases = [
            "ABC123",
            "Reference: ABC123",
            "myLicense Plate: ABC123",
            "License Plate:\nABC123",
            "License Plate:         ABC123",
            "ABC123(License Plate)",
            "License Plate: ABC12345x",
            "\u{1D7D9}License Plate: ABC123",
            "License Plate: ABC123_",
            "License Plate: ABC123\u{301}",
            "License  Plate: ABC123",
            "License Plate: ABC",
            "License Plate: ABCDEFGH",
            "License Plate: [LICENSE_PLATE]",
        ];

        for text in cases {
            assert!(spans(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn letters_are_ascii_only() {
        // Without the `u` flag, JS `i` does not fold `ſ` into `[A-Z]`.
        assert!(spans(&detector(), "License Plate: \u{17F}BC123").is_empty());
    }

    #[test]
    fn spans_for_multiple_plates() {
        assert_eq!(
            spans(
                &detector(),
                "License Plate: ABC123 and Plate Number: DEF456"
            ),
            [(15, 21), (40, 46)]
        );
    }
}
