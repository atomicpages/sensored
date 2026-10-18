//! Serbian unique master citizen number (JMBG). Mirrors `national-id/rs-jmbg.ts`.

use std::sync::LazyLock;

use super::{regex, two_digits};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Serbian|Serbia|JMBG|Jedinstveni|Matični|Personal)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `structurallyValid`: day 01-31, month 01-12.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let bytes = candidate.as_bytes();

    if bytes.len() != 13 {
        return None;
    }

    if !(1..=31).contains(&two_digits(bytes, 0)) {
        return None;
    }

    if !(1..=12).contains(&two_digits(bytes, 2)) {
        return None;
    }

    Some(&["rs_jmbg.structure"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "rs_jmbg",
        entity_type: "rs_jmbg",
        replacement: "[RS_JMBG]",
        pattern: LazyLock::new(|| regex(r"[0-9]{13}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Serbian",
            "Serbia",
            "JMBG",
            "Jedinstveni",
            "Matični",
            "Personal",
        ],
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

        for label in [
            "Serbian",
            "Serbia",
            "JMBG",
            "Jedinstveni",
            "Matični",
            "Personal",
        ] {
            assert_context_shape(&detector, label, "0101990123456");
        }
    }

    #[test]
    fn structure() {
        let detector = detector();

        assert_eq!(values(&detector, "JMBG: 3101990123456"), ["3101990123456"]);
        assert_eq!(values(&detector, "JMBG: 0112990123456"), ["0112990123456"]);
        assert_eq!(
            detect(&detector, "JMBG: 0101990123456")[0].reasons,
            ["rs_jmbg.structure", "rs_jmbg.context"]
        );

        for text in [
            "JMBG: 0099901234567",
            "JMBG: 3299901234567",
            "JMBG: 0100990123456",
            "JMBG: 0113990123456",
            "JMBG: 010199012345",
            "JMBG: 01019901234567",
            "JMBG: 00101990123456",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn unicode_label_folds_case() {
        let detector = detector();

        assert_eq!(
            values(&detector, "MATIČNI: 0101990123456"),
            ["0101990123456"]
        );
    }
}
