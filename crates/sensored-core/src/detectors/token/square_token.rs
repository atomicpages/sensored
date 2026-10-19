//! Square API tokens, near a keyword. Mirrors `token/square-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{KeywordDetector, StreamMeta};

pub(super) fn detector() -> KeywordDetector {
    KeywordDetector {
        id: "square_token",
        entity_type: "square_token",
        replacement: "[SQUARE_TOKEN]",
        pattern: LazyLock::new(|| {
            regex(r"EAAA[a-zA-Z0-9\-+=]{60}|sq0atp-[a-zA-Z0-9_-]{36}|sq0csp-[a-zA-Z0-9_-]{43}")
        }),
        keywords: &["square"],
        stream: StreamMeta::new(64, 40, 40),
    }
}
