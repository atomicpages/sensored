//! Mirrors `detectors/network/url-query-key.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::{format_detection, regex};
use crate::detector::{Detector, StreamMeta, is_adjacent_forbidden, push_aligned};
use crate::text::JS_SPACE_CLASS;
use crate::types::Detection;

const ID: &str = "url_query_key";

const KEYS: &str = "api_key|api-key|apikey|api_token|api-token|apitoken|access_token|access-token|accesstoken|auth_token|auth-token|authtoken|access_key|access-key|accesskey|secret_key|secret-key|secretkey|secret|private_key|private-key|privatekey|oauth_token|oauth-token|oauthtoken";

/// TS `/.../gi` without `u`: the key folds ASCII only. The value class has
/// no letters, so it stays Unicode-aware to match whole characters.
static PATTERN: LazyLock<Regex> =
    LazyLock::new(|| regex(&format!("[?&](?i-u:{KEYS})=((?:[^&#{JS_SPACE_CLASS}])+)")));

pub struct UrlQueryKeyDetector;

impl Detector for UrlQueryKeyDetector {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[URL_QUERY_KEY]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(8192, 0, 0))
    }

    fn detect(&self, text: &str, out: &mut Vec<Detection>) {
        let mut candidates = Vec::new();

        for captures in PATTERN.captures_iter(text) {
            let (Some(whole), Some(value)) = (captures.get(0), captures.get(1)) else {
                continue;
            };

            // TS quirk kept: the value's start is its first occurrence in the
            // whole match (`indexOf`), which may fall inside the key name.
            // That prefix is ASCII, so the byte and UTF-16 offsets agree.
            let offset = whole.as_str().find(value.as_str()).unwrap_or(0);
            let start = whole.start() + offset;
            let end = start + value.len();

            if is_adjacent_forbidden(text, start, end) {
                continue;
            }

            candidates.push(format_detection(ID, start, end));
        }

        push_aligned(text, candidates, out);
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/url-query-key.test.ts`.
    #[test]
    fn detects_values() {
        let cases = [
            (
                "https://api.example.com?api_key=secret123",
                &["secret123"][..],
            ),
            (
                "https://api.example.com?Api-Token=tok_abc123",
                &["tok_abc123"],
            ),
            ("https://api.example.com?SECRET=abc123", &["abc123"]),
            ("https://api.example.com?oauthtoken=abc123", &["abc123"]),
            (
                "https://api.example.com?api_key=key1&api_token=tok1",
                &["key1", "tok1"],
            ),
            (
                "https://api.example.com?foo=bar&api_key=secret123#frag",
                &["secret123"],
            ),
            ("?secret=abc 123", &["abc"]),
            ("?secret=abc\u{feff}123", &["abc"]),
            ("?secret=abc\u{85}123", &["abc\u{85}123"]),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&UrlQueryKeyDetector, input), expected, "{input}");
        }
    }

    #[test]
    fn rejects_other_keys_or_embedded_values() {
        let cases = [
            "https://api.example.com?token=abc123",
            "https://api.example.com?api_key=",
            "api_key=abc123",
            // `ſ` does not fold to `s` without the `u` flag.
            "?ſecret=abc123",
        ];

        for input in cases {
            assert!(values(&UrlQueryKeyDetector, input).is_empty(), "{input}");
        }
    }

    #[test]
    fn value_offset_is_its_first_occurrence() {
        // TS `indexOf` finds `e` inside `secret`; `s` before it is adjacent.
        assert!(values(&UrlQueryKeyDetector, "?secret=e").is_empty());
    }
}
