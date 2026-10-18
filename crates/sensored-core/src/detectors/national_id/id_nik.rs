//! Indonesian NIK. Mirrors `national-id/id-nik.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:Indonesia|Indonesian|NIK|Nomor Induk|KTP|National ID)";
const WINDOW: (usize, usize) = (35, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "id_nik",
        entity_type: "id_nik",
        replacement: "[ID_NIK]",
        pattern: LazyLock::new(|| regex(r"[0-9]{16}")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Indonesia",
            "Indonesian",
            "NIK",
            "Nomor Induk",
            "KTP",
            "National ID",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(16, WINDOW.0, WINDOW.1),
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
            "Indonesia",
            "Indonesian",
            "NIK",
            "Nomor Induk",
            "KTP",
            "National ID",
        ] {
            assert_context_shape(&detector, label, "1234567890123456");
        }
    }

    #[test]
    fn length_and_spans() {
        let detector = detector();

        assert!(values(&detector, "NIK: 123456789012345").is_empty());
        assert!(values(&detector, "NIK: 12345678901234567").is_empty());
        assert_eq!(
            spans(&detector, "NIK: 1234567890123456 and NIK: 9876543210987654"),
            [(5, 21), (31, 47)]
        );
        assert_eq!(spans(&detector, "😀 NIK: 1234567890123456"), [(10, 26)]);
        assert_eq!(
            detect(&detector, "NIK: 1234567890123456")[0].reasons,
            ["id_nik.format", "id_nik.context"]
        );
    }

    #[test]
    fn unicode_neighbours() {
        let detector = detector();

        for text in ["𝟙NIK: 1234567890123456", "NIK: 1234567890123456𝟙"] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
