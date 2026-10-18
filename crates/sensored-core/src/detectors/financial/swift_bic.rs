//! SWIFT/BIC code. Mirrors `detectors/financial/swift-bic.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:swift|bic|bank[- ]?code)";
const WINDOW: (usize, usize) = (40, 40);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "swift_bic",
        entity_type: "swift_bic",
        replacement: "[SWIFT_BIC]",
        // No `i` flag in TS: uppercase only.
        pattern: LazyLock::new(|| regex(r"[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["swift", "bic", "bank code"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(11, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/swift-bic.test.ts`.
    #[test]
    fn detects_bics() {
        let detector = detector();

        for value in [
            "DEUTDEFF",
            "DEUTDEFF500",
            "CHASUS33",
            "BARCGB22",
            "NEDSZAJJXXX",
        ] {
            assert_eq!(values(&detector, &format!("BIC: {value}")), [value]);
        }

        assert_eq!(values(&detector, "BIC: DEUTDEFF here"), ["DEUTDEFF"]);
        assert_eq!(values(&detector, "DEUTDEFF (SWIFT)."), ["DEUTDEFF"]);
    }

    /// From `test/swift-bic.test.ts`.
    #[test]
    fn rejects_bad_shapes() {
        let detector = detector();

        for text in [
            "BIC: DEUTDE",
            "BIC: deutdeff",
            "BIC: xDEUTDEFF",
            "BIC: DEUTDEFF5",
            "BIC: DEUTDEFF50",
            "BIC: DEUTDEFF_",
            "DEUTDEFF",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
