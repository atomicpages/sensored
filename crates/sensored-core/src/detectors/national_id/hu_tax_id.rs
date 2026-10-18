//! Hungarian tax ID (adóazonosító jel). Mirrors `national-id/hu-tax-id.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Hungarian|Magyar|Adó|Tax|Adóazonosító)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "hu_tax_id",
        entity_type: "hu_tax_id",
        replacement: "[HU_TAX_ID]",
        pattern: LazyLock::new(|| regex(r"[0-9]{10}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &["Hungarian", "Magyar", "Adó", "Tax", "Adóazonosító"],
        window: WINDOW,
        validate: None,
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

        for label in ["Hungarian", "Magyar", "Adó", "Tax", "Adóazonosító"] {
            assert_context_shape(&detector, label, "8123456789");
        }
    }

    #[test]
    fn length_and_reasons() {
        let detector = detector();

        assert!(values(&detector, "Adó: 812345678").is_empty());
        assert!(values(&detector, "Adó: 81234567890").is_empty());

        // `Adóazonosító` is 12 UTF-16 units but 15 bytes.
        assert_eq!(spans(&detector, "Adóazonosító: 8123456789"), [(17, 27)]);
        assert_eq!(
            detect(&detector, "Adó: 8123456789")[0].reasons,
            ["hu_tax_id.format", "hu_tax_id.context"]
        );
    }
}
