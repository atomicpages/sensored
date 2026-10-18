//! Mirrors `detectors/healthcare/medical-device-id.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::ts_ascii_ci;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Device|Implant|Pacemaker|Defibrillator|Serial|Medical)";
const WINDOW: (usize, usize) = (40, 20);

fn pattern() -> Regex {
    ts_ascii_ci(
        r"(?:DEVICE|IMPLANT|PACEMAKER|DEFIBRILLATOR){sep}?(?:SERIAL|SN|S/N){sep}?[:#]?{s}*[A-Z0-9]{8,20}",
    )
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "medical_device_id",
        entity_type: "medical_device_id",
        replacement: "[MEDICAL_DEVICE_ID]",
        pattern: LazyLock::new(pattern),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Device",
            "Implant",
            "Pacemaker",
            "Defibrillator",
            "Serial",
            "Medical",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(35, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/medical-device-id.test.ts`.
    #[test]
    fn detects_serials_with_context() {
        let cases = [
            ("Medical Device Serial: ABC12345", "Device Serial: ABC12345"),
            ("Medical Device SN: XYZ98765", "Device SN: XYZ98765"),
            (
                "Medical Implant S/N: DEF12345678",
                "Implant S/N: DEF12345678",
            ),
            (
                "Medical Pacemaker Serial: GHI98765432",
                "Pacemaker Serial: GHI98765432",
            ),
            (
                "Medical Defibrillator SN: JKL12345678",
                "Defibrillator SN: JKL12345678",
            ),
            ("medical device serial: abc12345", "device serial: abc12345"),
            (
                "Medical Device Serial: ABCDEFGHIJ1234567890",
                "Device Serial: ABCDEFGHIJ1234567890",
            ),
            (
                "Device Serial: ABC12345 (Medical)",
                "Device Serial: ABC12345",
            ),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&detector(), input), [expected], "{input}");
        }
    }

    /// From `test/medical-device-id.test.ts`.
    #[test]
    fn rejects_without_context_or_format() {
        let cases = [
            "Device Serial: ABC12345",
            "Reference: Device Serial: ABC12345",
            "Medical Device Serial: ABC1234",
            "Medical xDevice Serial: ABC12345",
            "Medical Device Serial: ABCDEFGHIJ12345678901",
            "Medical Device: ABC12345",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }

    #[test]
    fn case_folding_is_ascii_only() {
        // `PACEMAKER` holds a `K`; the Kelvin sign folds to it only under Unicode rules.
        assert!(values(&detector(), "Medical Pacema\u{212A}er SN: JKL12345678").is_empty());
    }
}
