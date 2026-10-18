//! US ABA routing number. Mirrors `detectors/financial/us-routing.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = r"(?:routing[- ]?(?:no\.?|number)?|aba|rtn)";
const WINDOW: (usize, usize) = (40, 40);

const WEIGHTS: [u32; 9] = [3, 7, 1, 3, 7, 1, 3, 7, 1];

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "us_routing",
        entity_type: "us_routing",
        replacement: "[US_ROUTING]",
        pattern: LazyLock::new(|| regex(r"[0-9]{9}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "routing",
            "routing no.",
            "routing no",
            "routing number",
            "aba",
            "rtn",
        ],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(9, WINDOW.0, WINDOW.1),
    }
}

/// The ABA check: digits weighted 3, 7, 1 repeating sum to a multiple of 10.
/// The pattern guarantees nine ASCII digits.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let sum: u32 = candidate
        .bytes()
        .zip(WEIGHTS)
        .map(|(byte, weight)| u32::from(byte - b'0') * weight)
        .sum();

    (sum % 10 == 0).then_some(&["us_routing.checksum", "us_routing.format"])
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{detect, values};
    use super::*;

    /// From `test/us-routing.test.ts`.
    #[test]
    fn detects_valid_numbers() {
        let detector = detector();

        for value in ["021000021", "026073150", "111000025", "121042882"] {
            let text = format!("Routing: {value}");

            assert_eq!(values(&detector, &text), [value]);
        }

        assert_eq!(values(&detector, "Routing: 021000021 here"), ["021000021"]);
        assert_eq!(values(&detector, "021000021 (Routing)"), ["021000021"]);
        assert_eq!(values(&detector, "Routing 021000021."), ["021000021"]);
        assert_eq!(values(&detector, "ABA# 021000021"), ["021000021"]);
        assert_eq!(values(&detector, "routing no. 021000021"), ["021000021"]);
    }

    /// From `test/us-routing.test.ts`.
    #[test]
    fn rejects_invalid_or_embedded() {
        let detector = detector();

        for text in [
            "Routing: 123456789",
            "Routing: 12345678",
            "Routing: foo021000021bar",
            "Routing: _021000021",
            "Routing: 021000021_",
            "021000021",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn reasons() {
        let found = detect(&detector(), "RTN 021000021");

        assert_eq!(
            found[0].reasons,
            [
                "us_routing.checksum",
                "us_routing.format",
                "us_routing.context"
            ]
        );
    }
}
