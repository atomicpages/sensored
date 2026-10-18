//! Mirrors `detectors/crypto/crypto-address.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::detector::{Detector, Input, StreamMeta, is_adjacent_forbidden, push_aligned};
use crate::types::Detection;

const ID: &str = "crypto_address";

/// Base58 without `0`, `O`, `I` and `l`.
macro_rules! base58 {
    () => {
        "[a-km-zA-HJ-NP-Z1-9]"
    };
}

static PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(concat!(
        "1",
        base58!(),
        "{25,34}|3",
        base58!(),
        "{25,34}|bc1[a-z0-9]{39,59}|0x[a-fA-F0-9]{40}|[LM]",
        base58!(),
        "{25,34}|ltc1[a-z0-9]{39,59}|[48]",
        base58!(),
        "{93}|r",
        base58!(),
        "{23,34}|addr1[a-z0-9]{50,120}",
        "|[1-9A-HJ-NP-Za-km-z]{32,44}|[1-9A-HJ-NP-Za-km-z]{46,48}",
        "|cosmos1[a-z0-9]{38}|[A-Z2-7]{58}|tz[1-4]",
        base58!(),
        "{33}|KT1",
        base58!(),
        "{33}|bnb1[a-z0-9]{38}",
    ))
    .expect("valid pattern")
});

pub struct CryptoAddressDetector;

impl Detector for CryptoAddressDetector {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[CRYPTO_ADDRESS]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(95, 0, 0))
    }

    fn detect_in(&self, input: &Input<'_>, out: &mut Vec<Detection>) {
        let text = input.text();

        let candidates = PATTERN
            .find_iter(text)
            .filter(|found| !is_adjacent_forbidden(text, found.start(), found.end()))
            .map(|found| Detection {
                start: found.start(),
                end: found.end(),
                rule_id: ID.into(),
                entity_type: ID.into(),
                reasons: vec!["crypto_address.format".into()],
            })
            .collect();

        push_aligned(text, candidates, out);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spans(text: &str) -> Vec<(usize, usize)> {
        let mut out = Vec::new();
        CryptoAddressDetector.detect(text, &mut out);

        out.iter().map(|d| (d.start, d.end)).collect()
    }

    #[test]
    fn finds_whole_addresses() {
        let generated = [
            format!("4{}", "A".repeat(93)),
            format!("addr1{}", "a".repeat(50)),
            format!("7{}", "x".repeat(31)),
            format!("7{}", "x".repeat(43)),
            format!("tz1{}", "K".repeat(33)),
            format!("KT1{}", "K".repeat(33)),
            format!("bnb1{}", "a".repeat(38)),
            format!("1{}", "a".repeat(25)),
            format!("1{}", "a".repeat(34)),
        ];

        let fixed = [
            "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
            "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
            "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
            "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
            "Lfm2M5m5P5QGefi2DMPTfTL5SLmv7DivfNa",
            "ltc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
            "rDsbeomare4J1k6t6U8Z2J5J2J2J2J2J2J",
        ];

        for text in fixed
            .iter()
            .copied()
            .chain(generated.iter().map(String::as_str))
        {
            assert_eq!(spans(text), [(0, text.len())], "{text}");
        }
    }

    #[test]
    fn finds_addresses_in_text() {
        assert_eq!(
            spans("Send to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa please"),
            [(8, 42)]
        );
        assert_eq!(
            spans("😀 0x742d35Cc6634C0532925a3b844Bc454e4438f44e"),
            [(5, 47)]
        );
    }

    #[test]
    fn rejects_short_or_embedded_candidates() {
        for text in ["", "hello world", "1234567890", "0x123", "bc1q", "1A1z"] {
            assert!(spans(text).is_empty(), "{text}");
        }

        assert!(spans("x1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa_").is_empty());
        assert!(spans("é1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa").is_empty());
    }
}
