//! Romanian personal numeric code (CNP). Mirrors `national-id/ro-cnp.ts`.

use std::sync::LazyLock;

use super::{regex, two_digits};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Romania|Romanian|CNP|Cod Numeric|Personal)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `structurallyValid`: sex digit 1-9, month 01-12, day 01-31.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let bytes = candidate.as_bytes();

    if bytes.len() != 13 {
        return None;
    }

    if bytes[0] == b'0' {
        return None;
    }

    if !(1..=12).contains(&two_digits(bytes, 3)) {
        return None;
    }

    if !(1..=31).contains(&two_digits(bytes, 5)) {
        return None;
    }

    Some(&["ro_cnp.structure"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ro_cnp",
        entity_type: "ro_cnp",
        replacement: "[RO_CNP]",
        pattern: LazyLock::new(|| regex(r"[0-9]{13}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Romania", "Romanian", "CNP", "Cod Numeric", "Personal"],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(13, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Romania", "Romanian", "CNP", "Cod Numeric", "Personal"] {
            assert_context_shape(&detector, label, "1901011234567");
        }
    }

    #[test]
    fn structure() {
        let detector = detector();

        assert_eq!(values(&detector, "CNP: 2911231789012"), ["2911231789012"]);
        assert_eq!(
            detect(&detector, "CNP: 1901011234567")[0].reasons,
            ["ro_cnp.structure", "ro_cnp.context"]
        );

        for text in [
            "CNP: 0900101234567",
            "CNP: 1900001234567",
            "CNP: 1901301234567",
            "CNP: 1900100234567",
            "CNP: 1900132234567",
            "CNP: 190101123456",
            "CNP: 19010112345678",
            "CNP: 01901011234567",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn multiple() {
        let detector = detector();

        assert_eq!(
            values(&detector, "CNP: 1901011234567 and CNP: 2850515123456"),
            ["1901011234567", "2850515123456"]
        );
    }
}
