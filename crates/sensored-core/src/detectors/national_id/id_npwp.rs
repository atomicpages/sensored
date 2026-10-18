//! Indonesian NPWP (tax ID). Mirrors `national-id/id-npwp.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Indonesia|NPWP|Tax|Pajak|Wajib Pajak)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "id_npwp",
        entity_type: "id_npwp",
        replacement: "[ID_NPWP]",
        pattern: LazyLock::new(|| {
            regex(r"[0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\.?[0-9][-.]?[0-9]{3}\.?[0-9]{3}")
        }),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Indonesia", "NPWP", "Tax", "Pajak", "Wajib Pajak"],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(20, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{assert_context_shape, detect, spans, values};
    use super::*;

    #[test]
    fn label_placement() {
        let detector = detector();

        for label in ["Indonesia", "NPWP", "Tax", "Pajak"] {
            assert_context_shape(&detector, label, "12.345.678.9-012.345");
        }

        // `Pajak` is a suffix of `Wajib Pajak`.
        assert_eq!(
            values(&detector, "Wajib Pajak: 12.345.678.9-012.345"),
            ["12.345.678.9-012.345"]
        );
    }

    #[test]
    fn separators() {
        let detector = detector();

        for value in [
            "12.345.678.9-012.345",
            "123456789012345",
            "12.345.678.9.012.345",
            "12345678.9012345",
        ] {
            assert_eq!(values(&detector, &format!("NPWP: {value}")), [value]);
        }

        assert!(values(&detector, "NPWP: 12.345.678.9--012.345").is_empty());
        assert!(values(&detector, "NPWP: 12-345-678-9-012-345").is_empty());
    }

    #[test]
    fn spans_and_reasons() {
        let detector = detector();

        assert_eq!(
            spans(
                &detector,
                "NPWP: 12.345.678.9-012.345 and NPWP: 98.765.432.1-098.765"
            ),
            [(6, 26), (37, 57)]
        );
        assert_eq!(spans(&detector, "NPWP: 12.345.678.9-012.345."), [(6, 26)]);
        assert_eq!(
            detect(&detector, "NPWP: 123456789012345")[0].reasons,
            ["id_npwp.format", "id_npwp.context"]
        );
    }
}
