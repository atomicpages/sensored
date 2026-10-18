//! PEM private keys. Mirrors `token/private-key.ts`.
//!
//! TS matches `BEGIN…[\s\S]{20,}?…END` without the `u` flag, so the body is
//! at least 20 UTF-16 units and ends at the first END marker after that.
//! Here the markers are found by regex and the minimum body is measured in
//! UTF-16 units in code.

use std::sync::LazyLock;

use regex::Regex;

use super::{detection, regex};
use crate::detector::{Detector, Input, StreamMeta, is_adjacent_forbidden, push_aligned};
use crate::types::Detection;

const ID: &str = "private_key";

/// Shortest key body, in UTF-16 units.
const MIN_BODY: usize = 20;

static BEGIN: LazyLock<Regex> =
    LazyLock::new(|| regex(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"));

static END: LazyLock<Regex> =
    LazyLock::new(|| regex(r"-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"));

pub struct PrivateKeyDetector;

impl Detector for PrivateKeyDetector {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[PRIVATE_KEY]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(65536, 0, 0))
    }

    fn detect_in(&self, input: &Input<'_>, out: &mut Vec<Detection>) {
        let text = input.text();

        let mut candidates = Vec::new();
        let mut from = 0;

        // A BEGIN with no END far enough after it means no later BEGIN has
        // one either, so each miss ends the scan.
        while let Some(begin) = BEGIN.find_at(text, from) {
            let Some(body_end) = advance_utf16(text, begin.end(), MIN_BODY) else {
                break;
            };

            let Some(end) = END.find_at(text, body_end) else {
                break;
            };

            let (start, end) = (begin.start(), end.end());

            if !is_adjacent_forbidden(text, start, end) {
                candidates.push(detection(ID, start, end, &["private_key.format"]));
            }

            from = end;
        }

        push_aligned(text, candidates, out);
    }
}

/// The first char boundary at least `units` UTF-16 units after `start`.
fn advance_utf16(text: &str, start: usize, units: usize) -> Option<usize> {
    let mut used = 0;

    for (offset, ch) in text[start..].char_indices() {
        if used >= units {
            return Some(start + offset);
        }

        used += ch.len_utf16();
    }

    (used >= units).then_some(text.len())
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    fn key(kind: &str, body: &str) -> String {
        format!("-----BEGIN {kind}PRIVATE KEY-----\n{body}\n-----END {kind}PRIVATE KEY-----")
    }

    #[test]
    fn finds_keys() {
        for kind in ["", "RSA ", "EC ", "DSA ", "OPENSSH "] {
            let pem = key(kind, "FAKEKEYFAKEKEYFAKEKEYFAKEKEY");

            assert_eq!(values(&PrivateKeyDetector, &pem), [pem.as_str()]);
        }

        let pem = key("", "FAKEKEYFAKEKEYFAKEKEYFAKEKEY");
        let text = format!("config:\n{pem}\ndone");

        assert_eq!(values(&PrivateKeyDetector, &text), [pem.as_str()]);
    }

    #[test]
    fn rejects_incomplete_or_short_keys() {
        let short = key("", "SHORT");
        let no_end = "-----BEGIN PRIVATE KEY-----\nFAKEKEYFAKEKEYFAKEKEYFAKEKEY";
        let public =
            "-----BEGIN PUBLIC KEY-----\nFAKEKEYFAKEKEYFAKEKEYFAKEKEY\n-----END PUBLIC KEY-----";

        for text in [short.as_str(), no_end, public] {
            assert!(values(&PrivateKeyDetector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn body_length_counts_utf16_units() {
        // 9 astral chars are 18 units: short of 20. Ten are 20.
        let nine = key("", &"😀".repeat(9)).replace('\n', "");
        let ten = key("", &"😀".repeat(10)).replace('\n', "");

        assert!(values(&PrivateKeyDetector, &nine).is_empty());
        assert_eq!(values(&PrivateKeyDetector, &ten), [ten.as_str()]);
    }

    #[test]
    fn stops_at_the_first_end_marker() {
        let first = key("", "FAKEKEYFAKEKEYFAKEKEYFAKEKEY");
        let text = format!("{first}\n-----END PRIVATE KEY-----");

        assert_eq!(values(&PrivateKeyDetector, &text), [first.as_str()]);
    }
}
