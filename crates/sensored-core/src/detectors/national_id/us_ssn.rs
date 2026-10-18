//! US Social Security number. Mirrors `national-id/ssn.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = r"(?:SSN|Social Security Number|Social Security No\.)";
const WINDOW: (usize, usize) = (39, 32);

/// Mirrors `structurallyValid` over the candidate with its dashes removed:
/// area not 000, 666 or 900+, group not 00, serial not 0000.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let mut digits = [0; 9];
    let mut len = 0;

    for byte in candidate.bytes().filter(|byte| *byte != b'-') {
        *digits.get_mut(len)? = byte;
        len += 1;
    }

    if len != 9 {
        return None;
    }

    let (area, rest) = digits.split_at(3);
    let (group, serial) = rest.split_at(2);

    if area == b"000" || area == b"666" || area[0] == b'9' {
        return None;
    }

    if group == b"00" || serial == b"0000" {
        return None;
    }

    Some(&["us_ssn.structure"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "us_ssn",
        entity_type: "us_ssn",
        replacement: "[US_SSN]",
        pattern: LazyLock::new(|| regex(r"[0-9]{3}-[0-9]{2}-[0-9]{4}|[0-9]{9}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["SSN", "Social Security Number", "Social Security No."],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(11, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["SSN", "Social Security Number", "Social Security No."] {
            assert_context_shape(&detector, label, "123-45-6789");
            assert_context_shape(&detector, label, "123456789");
        }
    }

    #[test]
    fn structure() {
        let detector = detector();

        assert_eq!(values(&detector, "SSN: 899-45-6789"), ["899-45-6789"]);
        assert_eq!(
            detect(&detector, "SSN: 123-45-6789")[0].reasons,
            ["us_ssn.structure", "us_ssn.context"]
        );

        for text in [
            "SSN: 000-45-6789",
            "SSN: 666-45-6789",
            "SSN: 900-45-6789",
            "SSN: 999-45-6789",
            "SSN: 123-00-6789",
            "SSN: 123-45-0000",
            "SSN: 000000000",
            "SSN: 123450000",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn format() {
        let detector = detector();

        for text in [
            "SSN: 1234-56-789",
            "SSN: 12-345-6789",
            "SSN: 123-456-789",
            "SSN: 123-45-678",
            "SSN: 123-45-67890",
            "SSN: 0123-45-6789",
            "SSN: 12345678",
            "SSN: 1234567890",
            "SSN: 123 45 6789",
            "Social  Security Number: 123-45-6789",
            "Social\tSecurity Number: 123-45-6789",
            "𝟙SSN: 123-45-6789",
            "SSN: 123-45-6789𝟙",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn spans_and_multiple() {
        let detector = detector();

        assert_eq!(spans(&detector, "SSN: 123-45-6789"), [(5, 16)]);
        assert_eq!(spans(&detector, "123-45-6789 (SSN)"), [(0, 11)]);
        assert_eq!(
            values(&detector, "SSN: 123-45-6789 and SSN: 234-56-7890"),
            ["123-45-6789", "234-56-7890"]
        );
        assert_eq!(
            values(&detector, "SSN:        123-45-6789"),
            ["123-45-6789"]
        );
    }
}
