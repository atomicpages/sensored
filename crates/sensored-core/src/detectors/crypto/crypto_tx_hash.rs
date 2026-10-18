//! Mirrors `detectors/crypto/crypto-tx-hash.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str =
    "(?:Transaction|Tx Hash|Transaction ID|Transaction Hash|Blockchain Transaction|TXID)";
const WINDOW: (usize, usize) = (40, 20);

pub(super) fn detector() -> ContextDetector {
    ContextDetector {
        id: "crypto_tx_hash",
        entity_type: "crypto_tx_hash",
        replacement: "[CRYPTO_TX_HASH]",
        pattern: LazyLock::new(|| Regex::new(r"[0-9a-fA-F]{64}").expect("valid pattern")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "Transaction",
            "Tx Hash",
            "Transaction ID",
            "Transaction Hash",
            "Blockchain Transaction",
            "TXID",
        ],
        window: WINDOW,
        validate: None,
        stream: StreamMeta::new(64, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use crate::detector::Detector;

    use super::*;

    const HASH: &str = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    fn values(text: &str) -> Vec<&str> {
        let mut out = Vec::new();
        detector().detect(text, &mut out);

        out.iter().map(|d| &text[d.start..d.end]).collect()
    }

    /// From `test/crypto-tx-hash.test.ts`.
    #[test]
    fn detects_labelled_hashes() {
        let upper = HASH.to_uppercase();
        let digits = "1".repeat(64);

        for value in [HASH, upper.as_str(), digits.as_str()] {
            assert_eq!(values(&format!("TXID: {value}")), [value]);
        }

        assert_eq!(values(&format!("{HASH} (Tx Hash).")), [HASH]);
        assert_eq!(values(&format!("\u{1F600} Transaction: {HASH}")), [HASH]);
        assert_eq!(
            values(&format!("TXID: {HASH} and TXID: {HASH}")),
            [HASH, HASH]
        );
    }

    /// From `test/crypto-tx-hash.test.ts`: windows are 40 units left, 20 right.
    #[test]
    fn context_window_edges() {
        let gap = |n: usize| " ".repeat(n);

        // Preceding: the label may sit at most 8 spaces from the hash.
        assert_eq!(values(&format!("Transaction:{} {HASH}", gap(7))), [HASH]);

        // A label beyond the 40-unit window is not seen.
        let far = format!("Transaction {}{HASH}", "x ".repeat(20));
        assert!(values(&far).is_empty());
    }

    /// From `test/crypto-tx-hash.test.ts`.
    #[test]
    fn rejects_embedded_or_unlabelled() {
        for text in [
            HASH.to_owned(),
            format!("TXID: x{HASH}"),
            format!("TXID: 1{HASH}"),
            format!("TXID: {HASH}1"),
            format!("TXID: {HASH}_"),
            format!("TXID: {HASH}\u{301}"),
            format!("TXID: {}", &HASH[..63]),
        ] {
            assert!(values(&text).is_empty(), "{text}");
        }
    }
}
