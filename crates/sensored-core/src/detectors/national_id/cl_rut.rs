//! Chilean RUT. Mirrors `national-id/cl-rut.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Chile|Chilean|RUT|Rol Único|Tributario|Cédula)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `rutValid`: mod 11 over the body with weights 2-7 from the right.
/// The pattern guarantees 8 or 9 characters once `.` and `-` are removed.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let mut clean = candidate
        .bytes()
        .filter(|byte| !matches!(byte, b'.' | b'-'));
    let check = clean.next_back()?.to_ascii_uppercase();

    let mut sum = 0;
    let mut multiplier = 2;

    for digit in clean.rev() {
        sum += u32::from(digit - b'0') * multiplier;
        multiplier = if multiplier == 7 { 2 } else { multiplier + 1 };
    }

    let expected = match sum % 11 {
        0 => b'0',
        1 => b'K',
        // 2..=10, so the difference is a single digit.
        remainder => b'0' + u8::try_from(11 - remainder).ok()?,
    };

    (check == expected).then_some(&["cl_rut.checksum"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "cl_rut",
        entity_type: "cl_rut",
        replacement: "[CL_RUT]",
        // JS `/\d{1,2}\.\d{3}\.\d{3}-[\dKk]/gi`: ASCII folding only.
        pattern: LazyLock::new(|| regex(r"[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9Kk]")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Chile",
            "Chilean",
            "RUT",
            "Rol Único",
            "Tributario",
            "Cédula",
        ],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(12, WINDOW.0, WINDOW.1),
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
            "Chile",
            "Chilean",
            "RUT",
            "Rol Único",
            "Tributario",
            "Cédula",
        ] {
            assert_context_shape(&detector, label, "12.345.678-5");
        }
    }

    #[test]
    fn checksum() {
        let detector = detector();

        assert_eq!(
            values(&detector, "RUT: 12.345.678-5 and RUT: 1.234.567-4"),
            ["12.345.678-5", "1.234.567-4"]
        );
        assert!(values(&detector, "RUT: 12.345.678-0").is_empty());
        assert!(values(&detector, "RUT: 12.345.678-3").is_empty());

        // Remainder 1 expects `K`, in either case.
        assert_eq!(values(&detector, "RUT: 10.000.013-K"), ["10.000.013-K"]);
        assert_eq!(values(&detector, "RUT: 10.000.013-k"), ["10.000.013-k"]);
        assert!(values(&detector, "RUT: 10.000.013-0").is_empty());

        // Remainder 0 expects `0`.
        assert_eq!(values(&detector, "RUT: 10.000.004-0"), ["10.000.004-0"]);
    }

    #[test]
    fn spans_and_reasons() {
        let detector = detector();

        // `Cédula` is 6 UTF-16 units but 7 bytes.
        assert_eq!(spans(&detector, "Cédula: 12.345.678-5"), [(9, 21)]);
        assert_eq!(spans(&detector, "RUT:        12.345.678-5"), [(12, 24)]);
        assert_eq!(
            detect(&detector, "RUT: 12.345.678-5")[0].reasons,
            ["cl_rut.checksum", "cl_rut.context"]
        );
    }
}
