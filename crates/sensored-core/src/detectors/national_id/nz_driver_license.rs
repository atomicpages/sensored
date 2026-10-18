//! New Zealand driver licence. Mirrors `national-id/nz-driver-license.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:New Zealand|NZ|Kiwi|Driver License|Driver Licence|Driver|License|Licence)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "nz_driver_license",
        entity_type: "nz_driver_license",
        replacement: "[NZ_DRIVER_LICENSE]",
        // JS `/[A-Z]{2}\d{6}/gi`: `i` without `u` folds ASCII only.
        pattern: LazyLock::new(|| regex(r"[A-Za-z]{2}[0-9]{6}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "New Zealand",
            "NZ",
            "Kiwi",
            "Driver License",
            "Driver Licence",
            "Driver",
            "License",
            "Licence",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(8, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Driver", "License", "Licence", "New Zealand", "NZ", "Kiwi"] {
            assert_context_shape(&detector, label, "AB123456");
        }
    }

    #[test]
    fn values_and_reasons() {
        let detector = detector();

        assert_eq!(values(&detector, "driver license: ab123456"), ["ab123456"]);
        assert_eq!(values(&detector, "AB123456 (Driver License)"), ["AB123456"]);
        assert_eq!(values(&detector, "Driver Licence: AB123456"), ["AB123456"]);

        for text in [
            "Driver: AB1234567",
            "Driver: 0AB123456",
            "Driver: AB12345",
            "Driver: A123456",
            "Driver: ABC123456",
            "Driver: \u{17F}B123456",
            "Driver: \u{212A}B123456",
        ] {
            assert!(values(&detector, text).is_empty(), "{text:?}");
        }

        assert_eq!(
            detect(&detector, "Driver: AB123456")[0].reasons,
            ["nz_driver_license.format", "nz_driver_license.context"]
        );
        assert_eq!(spans(&detector, "NZ Driver License: AB123456"), [(19, 27)]);
    }

    #[test]
    fn label_suffix() {
        let detector = detector();

        // "Driver License" ends in the label "License", so a word before it
        // still leaves a whole label.
        assert_eq!(
            values(&detector, "myDriver License: AB123456"),
            ["AB123456"]
        );
        assert!(values(&detector, "myDriver: AB123456").is_empty());
    }
}
