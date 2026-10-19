//! UK bank sort code. Mirrors `detectors/financial/uk-sort-code.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:sort[- ]?code|sort|branch[- ]?code|bank[- ]?code)";
const WINDOW: (usize, usize) = (40, 40);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "uk_sort_code",
        entity_type: "uk_sort_code",
        replacement: "[UK_SORT_CODE]",
        pattern: LazyLock::new(|| regex(r"[0-9]{2}[- ][0-9]{2}[- ][0-9]{2}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["sort code", "sort", "branch code", "bank code"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(8, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/uk-sort-code.test.ts`.
    #[test]
    fn detects_sort_codes() {
        let detector = detector();

        for (text, expected) in [
            ("sort code: 12-34-56", "12-34-56"),
            ("sort code: 12 34 56", "12 34 56"),
            ("Sort Code 12-34-56", "12-34-56"),
            ("sort 12-34-56", "12-34-56"),
            ("branch code 12-34-56", "12-34-56"),
            ("bank code: 12 34 56", "12 34 56"),
            ("Sort Code: 90-21-04 done", "90-21-04"),
            ("12-34-56 (sort code)", "12-34-56"),
        ] {
            assert_eq!(values(&detector, text), [expected], "{text}");
        }
    }

    /// From `test/uk-sort-code.test.ts`.
    #[test]
    fn rejects_without_context_or_embedded() {
        let detector = detector();

        for text in [
            "12-34-56",
            "code: 12-34-56",
            "sort code: x12-34-56",
            "sort code: 12-34-567",
            "sort code: 12.34.56",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
