//! Scaleway API keys, near a keyword. Mirrors `token/scaleway-key.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{KeywordDetector, StreamMeta};

pub(super) fn detector() -> KeywordDetector {
    KeywordDetector {
        id: "scaleway_key",
        entity_type: "scaleway_key",
        replacement: "[SCALEWAY_KEY]",
        pattern: LazyLock::new(|| {
            regex(r"[0-9a-z]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[0-9a-z]{4}-[0-9a-z]{12}")
        }),
        keywords: &["scaleway"],
        stream: StreamMeta::new(36, 40, 40),
    }
}
