//! Vietnamese citizen identity card (CCCD). Mirrors `national-id/vn-cccd.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Vietnam|Vietnamese|CCCD|Citizen Identity|CMND|National ID)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "vn_cccd",
        entity_type: "vn_cccd",
        replacement: "[VN_CCCD]",
        pattern: LazyLock::new(|| regex(r"[0-9]{12}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Vietnam",
            "Vietnamese",
            "CCCD",
            "Citizen Identity",
            "CMND",
            "National ID",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(12, WINDOW.0, WINDOW.1),
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
            "Vietnam",
            "Vietnamese",
            "CCCD",
            "Citizen Identity",
            "CMND",
            "National ID",
        ] {
            assert_context_shape(&detector, label, "123456789012");
        }
    }

    #[test]
    fn length() {
        let detector = detector();

        assert_eq!(
            detect(&detector, "CCCD: 123456789012")[0].reasons,
            ["vn_cccd.format", "vn_cccd.context"]
        );
        assert!(values(&detector, "CCCD: 12345678901").is_empty());
        assert!(values(&detector, "CCCD: 1234567890123").is_empty());
    }
}
