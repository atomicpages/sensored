//! Kazakhstan Individual Identification Number. Mirrors `national-id/kz-iin.ts`.

use std::sync::LazyLock;

use super::{month_day_valid, regex};
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Kazakhstan|Kazakh|IIN|Individual Identification|ЖСН)";
const WINDOW: (usize, usize) = (35, 20);

/// Mirrors `structurallyValid`: digits 3-4 are a month, 5-6 a day.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    month_day_valid(candidate).then_some(&["kz_iin.format"])
}

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "kz_iin",
        entity_type: "kz_iin",
        replacement: "[KZ_IIN]",
        pattern: LazyLock::new(|| regex(r"[0-9]{12}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Kazakhstan",
            "Kazakh",
            "IIN",
            "Individual Identification",
            "ЖСН",
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

        for label in ["IIN", "Kazakhstan", "Kazakh", "ЖСН"] {
            assert_context_shape(&detector, label, "890515300123");
        }

        // Too long for the 20-unit right window, so preceding only.
        assert_eq!(
            values(&detector, "Individual Identification: 890515300123"),
            ["890515300123"]
        );
        assert!(values(&detector, "890515300123 (Individual Identification)").is_empty());
    }

    #[test]
    fn month_and_day() {
        let detector = detector();

        assert_eq!(values(&detector, "жсн: 891231300123"), ["891231300123"]);

        for text in [
            "IIN: 890015300123",
            "IIN: 891315300123",
            "IIN: 890500300123",
            "IIN: 890532300123",
            "IIN: 8905153001234",
            "IIN: 89051530012",
            "IIN: 0890515300123",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn multiple_and_reasons() {
        let detector = detector();
        let text = "IIN: 890515300123 and ЖСН: 900101400456";

        assert_eq!(spans(&detector, text), [(5, 17), (30, 42)]);
        assert_eq!(
            detect(&detector, text)[0].reasons,
            ["kz_iin.format", "kz_iin.context"]
        );
    }
}
