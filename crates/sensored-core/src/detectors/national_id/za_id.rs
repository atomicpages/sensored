//! South African identity number. Mirrors `national-id/za-id.ts`.

use std::sync::LazyLock;

use super::{regex, two_digits};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:South Africa|RSA|ZA|National ID|Identity|ID Number)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `structurallyValid`: month 01-12, day 01-31 after the year.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let bytes = candidate.as_bytes();

    if bytes.len() != 13 {
        return None;
    }

    if !(1..=12).contains(&two_digits(bytes, 2)) {
        return None;
    }

    if !(1..=31).contains(&two_digits(bytes, 4)) {
        return None;
    }

    Some(&["za_id.structure"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "za_id",
        entity_type: "za_id",
        replacement: "[ZA_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{13}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "South Africa",
            "RSA",
            "ZA",
            "National ID",
            "Identity",
            "ID Number",
        ],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(13, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in [
            "South Africa",
            "RSA",
            "ZA",
            "National ID",
            "Identity",
            "ID Number",
        ] {
            assert_context_shape(&detector, label, "9001015000080");
        }
    }

    #[test]
    fn structure() {
        let detector = detector();

        assert_eq!(
            detect(&detector, "National ID: 9001015000080")[0].reasons,
            ["za_id.structure", "za_id.context"]
        );

        for text in [
            "National ID: 9000015000080",
            "National ID: 9013015000080",
            "National ID: 9001005000080",
            "National ID: 9001325000080",
            "National ID: 900101500008",
            "National ID: 90010150000800",
            "National ID: 09001015000080",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn multiple() {
        let detector = detector();

        assert_eq!(
            spans(
                &detector,
                "National ID: 9001015000080 and National ID: 8502156000091"
            ),
            [(13, 26), (44, 57)]
        );
    }
}
