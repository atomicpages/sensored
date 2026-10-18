//! Mirrors `detectors/network/url-with-auth.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::{format_detection, regex};
use crate::detector::{Detector, StreamMeta, is_adjacent_forbidden, push_aligned};
use crate::text::{JS_SPACE_CLASS, is_js_space};
use crate::types::Detection;

const ID: &str = "url_with_auth";

static PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    let s = JS_SPACE_CLASS;

    regex(&format!(
        "(?:https?|ftp)://[^{s}:/@?#]+:[^{s}/@?#]+@[^{s}/@?#]+[^{s}]*"
    ))
});

pub struct UrlWithAuthDetector;

impl Detector for UrlWithAuthDetector {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[URL_WITH_AUTH]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(2048, 0, 0))
    }

    fn detect(&self, text: &str, out: &mut Vec<Detection>) {
        let mut candidates = Vec::new();

        for found in PATTERN.find_iter(text) {
            let start = found.start();

            // Trailing underscores the greedy tail took would hide an
            // embedded match from the adjacency check.
            let mut end = start + found.as_str().trim_end_matches('_').len();

            // A single trailing period is prose punctuation.
            let ends_sentence =
                text[..end].ends_with('.') && text[end..].chars().next().is_none_or(is_js_space);

            if ends_sentence {
                end -= 1;
            }

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

    /// From `test/url-with-auth.test.ts`.
    #[test]
    fn detects_urls() {
        let cases = [
            (
                "https://user:pass@example.com",
                "https://user:pass@example.com",
            ),
            (
                "ftp://user:pass@ftp.example.com/file",
                "ftp://user:pass@ftp.example.com/file",
            ),
            (
                "https://user:p@ss@example.com/path",
                "https://user:p@ss@example.com/path",
            ),
            (
                "URL https://user:pass@example.com.",
                "https://user:pass@example.com",
            ),
            (
                "https://user:pass@example.com.\u{feff}",
                "https://user:pass@example.com",
            ),
            (
                "https://user:pass@example.com:8080/api?key=value",
                "https://user:pass@example.com:8080/api?key=value",
            ),
            // Only one period is trimmed.
            (
                "https://user:pass@example.com..",
                "https://user:pass@example.com.",
            ),
            // A period inside the URL stays.
            (
                "https://user:pass@example.com.x",
                "https://user:pass@example.com.x",
            ),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&UrlWithAuthDetector, input), [expected], "{input}");
        }
    }

    /// From `test/url-with-auth.test.ts`.
    #[test]
    fn rejects_urls_without_credentials_or_embedded() {
        let cases = [
            "https://example.com/api",
            "https://user:@example.com",
            "https://:pass@example.com",
            "ssh://user:pass@example.com",
            "foohttps://user:pass@example.com",
            "_https://user:pass@example.com",
        ];

        for input in cases {
            assert!(values(&UrlWithAuthDetector, input).is_empty(), "{input}");
        }
    }

    #[test]
    fn trailing_underscores_are_trimmed_before_the_adjacency_check() {
        // `_` itself is adjacent once trimmed off.
        assert!(values(&UrlWithAuthDetector, "https://user:pass@example.com_").is_empty());
        assert!(values(&UrlWithAuthDetector, "https://user:pass@example.com__").is_empty());

        // The period is not trimmed: `_` follows it, and then rejects it.
        assert!(values(&UrlWithAuthDetector, "https://user:pass@example.com._ x").is_empty());

        // Underscores inside the tail stay.
        assert_eq!(
            values(&UrlWithAuthDetector, "https://user:pass@example.com_x"),
            ["https://user:pass@example.com_x"]
        );
    }
}
