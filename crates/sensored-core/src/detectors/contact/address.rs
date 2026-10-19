//! Mirrors `detectors/contact/address.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LEFT_CONTEXT: usize = 40;
const RIGHT_CONTEXT: usize = 20;

const LABELS: &str = "(?:Address|Street|Home Address|Mailing Address|Residence|Postal Address)";

// TS compiles this with `gi` and no `u`, so case folding is ASCII only: the
// letter classes are spelled out and the suffixes fold with `(?i-u)`, which
// keeps `ſ` and the Kelvin sign from matching `s` and `k`.
const PATTERN: &str = concat!(
    r"[0-9]{1,6}[ \t]+[A-Za-z][A-Za-z0-9.'\x{2019}-]*",
    r"(?:[ \t]+[A-Za-z0-9][A-Za-z0-9.'\x{2019}-]*){0,4}[ \t]+",
    r"(?i-u:St(?:reet)?|Ave(?:nue)?|Rd|Road|Blvd|Boulevard|Lane|Ln|Dr(?:ive)?|Ct|Court",
    r"|Pl(?:ace)?|Sq(?:uare)?|Ter(?:race)?|Cir(?:cle)?|Way|Pkwy|Parkway|Hwy|Highway)",
);

pub fn detector() -> ContextDetector {
    ContextDetector {
        id: "address",
        entity_type: "address",
        replacement: "[ADDRESS]",
        pattern: LazyLock::new(|| Regex::new(PATTERN).expect("valid pattern")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, LEFT_CONTEXT, RIGHT_CONTEXT)),
        labels: &[
            "Address",
            "Street",
            "Home Address",
            "Mailing Address",
            "Residence",
            "Postal Address",
        ],
        window: (LEFT_CONTEXT, RIGHT_CONTEXT),
        validate: None,
        stream: StreamMeta::new(120, LEFT_CONTEXT, RIGHT_CONTEXT),
    }
}

#[cfg(test)]
mod tests {
    use super::super::found;
    use super::*;

    #[test]
    fn finds_labelled_addresses() {
        let address = detector();

        for (text, value) in [
            ("Address: 123 Main St", "123 Main St"),
            (
                "Address: 100 Pennsylvania Avenue",
                "100 Pennsylvania Avenue",
            ),
            ("Home Address: 10 Downing Street", "10 Downing Street"),
            ("Address: 999 West 42nd St", "999 West 42nd St"),
            ("Address: 123 Main St.", "123 Main St"),
            ("Address: 123456 West Main St", "123456 West Main St"),
            ("Address: 123 O'Brien Street", "123 O'Brien Street"),
            (
                "Address: 123 O\u{2019}Brien Street",
                "123 O\u{2019}Brien Street",
            ),
            ("Address: 123 Park-Avenue Ave", "123 Park-Avenue Ave"),
            ("123 Main St (Address)", "123 Main St"),
            ("123 Main St Address", "123 Main St"),
            ("123 Main St        (Address)", "123 Main St"),
            ("address: 123 main st", "123 main st"),
            ("ADDRESS: 123 MAIN ST", "123 MAIN ST"),
            ("Address#123 Main St", "123 Main St"),
            ("Address: \t 123 Main St", "123 Main St"),
        ] {
            assert_eq!(found(&address, text), [value], "{text}");
        }

        assert_eq!(
            found(&address, "Address: 123 Main St and Address: 456 Oak St"),
            ["123 Main St", "456 Oak St"]
        );
    }

    #[test]
    fn rejects_unlabelled_or_embedded_candidates() {
        let address = detector();

        for text in [
            "Meet me at 123 Main St",
            "Address: 123 Main Stx",
            "Address: 123Main St",
            "Reference: 123 Main St",
            "myAddress: 123 Main St",
            "Address:\n123 Main St",
            "Address: 123 Main St123",
            "Address: 1234567 Main St",
            "Address: 123 Main St\u{1d7d9}",
            "Address: \u{1d7d9}123 Main St",
            "Address: 123 Main St\u{301}",
            "Address: 123 Main Streetlight",
            "Address: 123 Main Plaza",
            "x123 Main St (Address)",
        ] {
            assert!(found(&address, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn suffix_case_folding_is_ascii_only() {
        let address = detector();

        // `ſ` folds to `s` and U+212A to `k` only under Unicode case folding.
        assert!(found(&address, "Address: 123 Main \u{17f}t").is_empty());
        assert!(found(&address, "Address: 123 Main P\u{212a}wy").is_empty());
        assert!(found(&address, "Address: 123 \u{17f}outh St").is_empty());
    }
}
