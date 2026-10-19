//! UK NHS number. Mirrors `national-id/uk-nhs.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = r"(?:nhs[- ]?(?:no\.?|number)?|patient)";
const WINDOW: (usize, usize) = (40, 40);

/// Mirrors `validate` and `nhsChecksum`: nine digits once `-` and spaces are
/// removed, weighted 10 down to 2, with a sum divisible by 11.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let digits = candidate
        .bytes()
        .filter(|byte| !matches!(byte, b'-' | b' '));

    if digits.clone().count() != 9 {
        return None;
    }

    let sum: u32 = digits
        .zip((2..=10).rev())
        .map(|(digit, weight)| u32::from(digit - b'0') * weight)
        .sum();

    if sum % 11 != 0 {
        return None;
    }

    Some(&["uk_nhs.checksum", "uk_nhs.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "uk_nhs",
        entity_type: "uk_nhs",
        replacement: "[UK_NHS]",
        pattern: LazyLock::new(|| regex(r"[0-9]{3}[- ]?[0-9]{3}[- ]?[0-9]{3}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["nhs", "nhs no.", "nhs no", "nhs number", "patient"],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(11, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in [
            "nhs",
            "nhs no.",
            "nhs no",
            "nhs number",
            "NHS-number",
            "patient",
        ] {
            assert_context_shape(&detector, label, "408123462");
        }
    }

    #[test]
    fn checksum() {
        let detector = detector();

        for value in [
            "408123462",
            "408-123-462",
            "408 123 462",
            "599012345",
            "408-123 462",
        ] {
            assert_eq!(values(&detector, &format!("NHS: {value}")), [value]);
        }

        assert_eq!(
            detect(&detector, "NHS: 408123462")[0].reasons,
            ["uk_nhs.checksum", "uk_nhs.format", "uk_nhs.context"]
        );

        for text in [
            "NHS: 408123456",
            "NHS: 40812346",
            "NHS: foo408123462bar",
            "NHS: 408--123-462",
            "NHS: 943 476 5919",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
