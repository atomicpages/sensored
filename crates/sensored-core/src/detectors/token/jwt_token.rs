//! JSON Web Tokens. Mirrors `token/jwt-token.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::{detection, regex};
use crate::detector::{Detector, StreamMeta, is_adjacent_forbidden, push_aligned};
use crate::types::Detection;

const ID: &str = "jwt_token";

static PATTERN: LazyLock<Regex> =
    LazyLock::new(|| regex(r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"));

pub struct JwtTokenDetector;

impl Detector for JwtTokenDetector {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[JWT_TOKEN]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(4096, 0, 0))
    }

    fn detect(&self, text: &str, out: &mut Vec<Detection>) {
        let mut candidates = Vec::new();

        for found in PATTERN.find_iter(text) {
            let start = found.start();

            // Trailing underscores are trimmed so the adjacency check sees
            // a match embedded in a larger word.
            let trimmed = found.as_str().trim_end_matches('_');
            let end = start + trimmed.len();

            if is_adjacent_forbidden(text, start, end) {
                continue;
            }

            candidates.push(detection(ID, start, end, &["jwt_token.format"]));
        }

        push_aligned(text, candidates, out);
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    const TOKEN: &str = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJmYWtlIn0.c2lnbmF0dXJl";

    #[test]
    fn finds_tokens() {
        assert_eq!(values(&JwtTokenDetector, TOKEN), [TOKEN]);
        assert_eq!(
            values(&JwtTokenDetector, &format!("Token: {TOKEN} here")),
            [TOKEN]
        );
        assert_eq!(values(&JwtTokenDetector, &format!("{TOKEN}.")), [TOKEN]);
    }

    #[test]
    fn rejects_malformed_or_embedded_tokens() {
        for text in [
            "abc.eyJzdWIiOiJmYWtlIn0.c2lnbmF0dXJl".to_owned(),
            "eyJhbGciOiJub25lIn0.eyJzdWIiOiJmYWtlIn0".to_owned(),
            format!("x{TOKEN}"),
            format!("_{TOKEN}"),
            format!("{TOKEN}_"),
        ] {
            assert!(values(&JwtTokenDetector, &text).is_empty(), "{text}");
        }
    }
}
