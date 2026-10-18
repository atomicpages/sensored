//! Driver's license numbers near a label. Mirrors `identity/drivers-license.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LEFT_CONTEXT: usize = 30;
const RIGHT_CONTEXT: usize = 20;

const LABELS: &str = r"(?:Driver['’]s License|Driving Licence|License No\.|DL)";

/// The TS pattern has the `gi` flags without `u`: ASCII letters only.
const PATTERN: &str = r"[A-Za-z0-9]{6,16}";

fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    if !candidate.bytes().any(|byte| byte.is_ascii_digit()) {
        return None;
    }

    Some(&["drivers_license.format"])
}

pub fn detector() -> ContextDetector {
    ContextDetector {
        id: "drivers_license",
        entity_type: "drivers_license",
        replacement: "[DRIVERS_LICENSE]",
        pattern: LazyLock::new(|| Regex::new(PATTERN).expect("valid pattern")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, LEFT_CONTEXT, RIGHT_CONTEXT)),
        labels: &["Driver's License", "Driving Licence", "License No.", "DL"],
        window: (LEFT_CONTEXT, RIGHT_CONTEXT),
        validate: Some(validate),
        stream: StreamMeta::new(16, LEFT_CONTEXT, RIGHT_CONTEXT),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detectors::identity::test_support::{spans, values};

    #[test]
    fn matches_labelled_licenses() {
        let detector = detector();
        let cases = [
            ("DL: 123456789", "123456789"),
            ("Driver's License: A123456789", "A123456789"),
            ("Driver\u{2019}s License: A123456789", "A123456789"),
            ("License No.: D12345678", "D12345678"),
            ("Driving Licence: SMITH123456AB123", "SMITH123456AB123"),
            ("dl: 123456789", "123456789"),
            ("(DL: 123456789)", "123456789"),
        ];

        for (text, value) in cases {
            assert_eq!(values(&detector, text), [value], "{text}");
        }
    }

    #[test]
    fn rejects_unlabelled_or_invalid_candidates() {
        let detector = detector();
        let cases = [
            "123456789",
            "My number is 123456789",
            "DL: 12345",
            "DL: 12345678901234567",
            "DL: 123456789_",
            "DL: ABCDEFGH",
        ];

        for text in cases {
            assert!(spans(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn offsets_are_bytes_after_wide_chars() {
        assert_eq!(spans(&detector(), "\u{1F600} DL: 123456789"), [(9, 18)]);
    }
}
