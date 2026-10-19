//! Okta API tokens, near a keyword. Mirrors `token/okta-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{KeywordDetector, StreamMeta};

pub(super) fn detector() -> KeywordDetector {
    KeywordDetector {
        id: "okta_token",
        entity_type: "okta_token",
        replacement: "[OKTA_TOKEN]",
        pattern: LazyLock::new(|| regex(r"00[a-zA-Z0-9_-]{40}")),
        keywords: &["okta"],
        stream: StreamMeta::new(42, 40, 40),
    }
}
