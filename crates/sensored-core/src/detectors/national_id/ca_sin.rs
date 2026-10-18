//! Canadian Social Insurance Number. Mirrors `national-id/ca-sin.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::checksum::luhn_valid;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "ca_sin",
        entity_type: "ca_sin",
        replacement: "[CA_SIN]",
        // Leftmost-first alternation, as in JS.
        pattern: LazyLock::new(|| regex(r"[0-9]{3}-[0-9]{3}-[0-9]{3}|[0-9]{9}")),
        validate: sin_valid,
        stream: StreamMeta::new(11, 0, 0),
    }
}

/// Luhn over the nine digits; the pattern guarantees the count.
fn sin_valid(candidate: &str) -> Option<&'static [&'static str]> {
    let digits = candidate.replace('-', "");

    luhn_valid(&digits).then_some(&["ca_sin.luhn", "ca_sin.format"])
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{detect, spans, values};
    use super::*;

    #[test]
    fn valid_numbers() {
        let detector = detector();

        for value in ["046-454-286", "046454286", "123-456-782", "123456782"] {
            assert_eq!(values(&detector, value), [value]);
        }
    }

    #[test]
    fn surroundings() {
        let detector = detector();

        assert_eq!(
            values(&detector, "046-454-286 and 123456782"),
            ["046-454-286", "123456782"]
        );
        assert_eq!(values(&detector, "[046-454-286]."), ["046-454-286"]);
        assert_eq!(spans(&detector, "SIN: 046-454-286"), [(5, 16)]);
        assert_eq!(
            detect(&detector, "SIN: 046-454-286")[0].reasons,
            ["ca_sin.luhn", "ca_sin.format"]
        );
    }

    #[test]
    fn invalid_numbers() {
        let detector = detector();

        for text in [
            "123-456-789",
            "123456789",
            "046-454-28",
            "04645428",
            "046-454-2860",
            "0464542860",
            "046454286extra",
            "extra046454286",
            "046454286_",
            "_046454286",
            "046454286\u{301}",
            "𝟙046454286",
            "046454286𝟙",
            "my046-454-286file",
            "123-456-7890",
        ] {
            assert!(values(&detector, text).is_empty(), "{text}");
        }
    }
}
