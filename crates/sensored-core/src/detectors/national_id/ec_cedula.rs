//! Ecuadorian cédula. Mirrors `national-id/ec-cedula.ts`.

use std::sync::LazyLock;

use super::{regex, two_digits};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Ecuador|Ecuadorian|Cédula|Cedula|Identidad)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `ecCedulaValid`: province 1-24, third digit 0-6 or 9. The pattern
/// guarantees ten ASCII digits.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let digits = candidate.as_bytes();
    let province = two_digits(digits, 0);
    let third = digits[2] - b'0';

    let third_valid = third <= 6 || third == 9;

    ((1..=24).contains(&province) && third_valid).then_some(&["ec_cedula.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "ec_cedula",
        entity_type: "ec_cedula",
        replacement: "[EC_CEDULA]",
        pattern: LazyLock::new(|| regex(r"[0-9]{10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Ecuador", "Ecuadorian", "Cédula", "Cedula", "Identidad"],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(10, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Ecuador", "Ecuadorian", "Cédula", "Cedula", "Identidad"] {
            assert_context_shape(&detector, label, "1712345678");
        }
    }

    #[test]
    fn province_and_third_digit() {
        let detector = detector();

        for value in ["0212345678", "2412345678", "1792345678", "1762345678"] {
            assert_eq!(values(&detector, &format!("Cédula: {value}")), [value]);
        }

        for value in ["0012345678", "2512345678", "1773456789", "1783456789"] {
            assert!(
                values(&detector, &format!("Cédula: {value}")).is_empty(),
                "{value}"
            );
        }
    }

    #[test]
    fn spans_and_reasons() {
        let detector = detector();

        // `Cédula` is 6 UTF-16 units but 7 bytes.
        assert_eq!(spans(&detector, "Cédula:        1712345678"), [(16, 26)]);
        assert!(values(&detector, "Cédula: 123456789").is_empty());
        assert!(values(&detector, "Cédula: 12345678901").is_empty());
        assert_eq!(
            detect(&detector, "Cédula: 1712345678")[0].reasons,
            ["ec_cedula.format", "ec_cedula.context"]
        );
    }
}
