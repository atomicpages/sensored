//! HTTP authorization header values. Mirrors `token/http-auth-header.ts`.
//!
//! The TS pattern has the `gi` flags without `u`, so it is built under
//! `(?i-u)`: ASCII letters fold ASCII only and `\w` is ASCII. JS `\s` and
//! `\S` switch Unicode back on for their class.
//!
//! `detectorOptions.http_auth_header.customHeaders` adds string headers as
//! literal alternatives (`escapeRegExp(h) + \s*:\s*`) after the defaults, as
//! `buildHttpAuthHeaderPattern` does. `RegExp` headers never reach the core:
//! the TS wrapper resolves them.

use std::sync::LazyLock;

use regex::Regex;

use super::{detection, js_non_space, js_space, regex};
use crate::detector::{Detector, Input, StreamMeta, is_adjacent_forbidden, push_aligned};
use crate::types::Detection;

const ID: &str = "http_auth_header";

/// `DEFAULT_ALTERNATIVES`, verbatim. `\s` is replaced when compiling.
const DEFAULT_ALTERNATIVES: &str = r"Authorization:\s*(?:Basic|Bearer|Digest)\s+|Proxy-Authorization:\s*(?:Basic|Bearer|Digest)\s+|X-[\w-]*(?:Key|Token|Secret)\s*:\s*|Api-Key\s*:\s*|ApiKey\s*:\s*|Ocp-Apim-Subscription-Key\s*:\s*";

static DEFAULT_PATTERN: LazyLock<Regex> = LazyLock::new(|| compile(&[]));

pub struct HttpAuthHeaderDetector {
    pattern: Regex,
}

/// The built-in detector.
pub(super) fn detector() -> HttpAuthHeaderDetector {
    HttpAuthHeaderDetector {
        pattern: DEFAULT_PATTERN.clone(),
    }
}

/// The detector with `customHeaders` matched after the built-in headers.
pub(crate) fn with_custom_headers(headers: &[String]) -> HttpAuthHeaderDetector {
    HttpAuthHeaderDetector {
        pattern: compile(headers),
    }
}

/// Mirrors `buildHttpAuthHeaderPattern` for string headers.
fn compile(headers: &[String]) -> Regex {
    let space = js_space();
    let separator = format!("{space}*:{space}*");
    let mut alternatives = DEFAULT_ALTERNATIVES.replace(r"\s", &space);

    for header in headers {
        alternatives.push('|');
        alternatives.push_str(&js_literal(header));
        alternatives.push_str(&separator);
    }

    regex(&format!("(?i-u:(?:{alternatives})({}+))", js_non_space()))
}

/// `header` as a literal under JS case-insensitive matching without `u`.
///
/// ASCII folds ASCII only, which `(?i-u)` already does. A BMP char matches
/// every BMP char with the same JS `Canonicalize` (simple uppercase, kept
/// unless it maps non-ASCII to ASCII). Astral chars are surrogate pairs
/// there, which never fold.
fn js_literal(header: &str) -> String {
    let mut literal = String::new();

    for ch in header.chars() {
        if ch.is_ascii() || ch.len_utf16() == 2 {
            literal.push_str(&regex::escape(ch.encode_utf8(&mut [0; 4])));
            continue;
        }

        let canonical = canonicalize(ch);
        let class: String = ('\u{80}'..='\u{FFFF}')
            .filter(|&other| canonicalize(other) == canonical)
            .map(|other| regex::escape(other.encode_utf8(&mut [0; 4])))
            .collect();

        literal.push_str(&format!("(?u-i:[{class}])"));
    }

    literal
}

/// JS `Canonicalize(ch)` for a regex with `i` and without `u`.
fn canonicalize(ch: char) -> char {
    let mut upper = ch.to_uppercase();

    match (upper.next(), upper.next()) {
        (Some(single), None) if !(single.is_ascii() && !ch.is_ascii()) => single,
        _ => ch,
    }
}

impl Detector for HttpAuthHeaderDetector {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[HTTP_AUTH_HEADER]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(1024, 0, 0))
    }

    fn detect_in(&self, input: &Input<'_>, out: &mut Vec<Detection>) {
        let text = input.text();

        let mut candidates = Vec::new();

        for captures in self.pattern.captures_iter(text) {
            // The value group ends the match, so TS's `lastIndexOf(value)`
            // is the group's own start.
            let Some(value) = captures.get(1) else {
                continue;
            };

            if is_adjacent_forbidden(text, value.start(), value.end()) {
                continue;
            }

            candidates.push(detection(
                ID,
                value.start(),
                value.end(),
                &["http_auth_header.format"],
            ));
        }

        push_aligned(text, candidates, out);
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    #[test]
    fn finds_built_in_headers() {
        for (text, value) in [
            ("Authorization: Basic dXNlcjpwYXNz", "dXNlcjpwYXNz"),
            ("Proxy-Authorization: Bearer dXNlcjpwYXNz", "dXNlcjpwYXNz"),
            (
                "authorization: digest username=\"admin\"",
                "username=\"admin\"",
            ),
            ("Api-Key: sk-1234567890abcdef", "sk-1234567890abcdef"),
            ("ApiKey: my-secret-key-123", "my-secret-key-123"),
            ("Ocp-Apim-Subscription-Key: abc123def456", "abc123def456"),
            ("X-Api-Key: abc123def456", "abc123def456"),
            ("X-Auth-Token: tok_abc123", "tok_abc123"),
            ("X-Secret-Key: secret_value_here", "secret_value_here"),
            ("xApi-Key: secret123", "secret123"),
            ("The key is Api-Key: secret123", "secret123"),
        ] {
            assert_eq!(values(&detector(), text), [value], "{text}");
        }

        assert_eq!(
            values(&detector(), "Api-Key: key1\nApi-Key: key2"),
            ["key1", "key2"]
        );
    }

    #[test]
    fn rejects_other_headers() {
        for text in [
            "Authorization: dXNlcjpwYXNz",
            "X-Custom-Header: value123",
            "Api-Key:",
        ] {
            assert!(values(&detector(), text).is_empty(), "{text}");
        }
    }

    #[test]
    fn value_stops_at_js_space() {
        assert_eq!(values(&detector(), "Api-Key: abc\u{feff}def"), ["abc"]);
        assert_eq!(
            values(&detector(), "Api-Key: abc\u{85}def"),
            ["abc\u{85}def"]
        );
    }

    #[test]
    fn custom_headers_are_literal() {
        let custom = with_custom_headers(&["X-Example-Auth".to_owned(), "Session.Id".to_owned()]);
        let text =
            "Authorization: Basic dXNlcjpwYXNz\nX-Example-Auth: v1\nsession.id: v2\nSessionXId: v3";

        assert_eq!(values(&custom, text), ["dXNlcjpwYXNz", "v1", "v2"]);
    }

    #[test]
    fn custom_headers_fold_like_js_without_u() {
        let custom =
            with_custom_headers(&["Clé".to_owned(), "Straße".to_owned(), "Kelvin".to_owned()]);

        assert_eq!(values(&custom, "CLÉ: a"), ["a"]);
        assert_eq!(values(&custom, "STRAßE: b"), ["b"]);
        assert!(values(&custom, "STRAẞE: c").is_empty());
        assert!(values(&custom, "\u{212A}elvin: d").is_empty());
    }
}
