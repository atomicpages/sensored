//! Mailgun API keys, near a keyword. Mirrors `token/mailgun-api-key.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{KeywordDetector, StreamMeta};

pub(super) fn detector() -> KeywordDetector {
    KeywordDetector {
        id: "mailgun_api_key",
        entity_type: "mailgun_api_key",
        replacement: "[MAILGUN_API_KEY]",
        pattern: LazyLock::new(|| regex(r"key-[a-z0-9]{32}|[a-f0-9]{32}-[a-f0-9]{8}-[a-f0-9]{8}")),
        keywords: &["mailgun"],
        stream: StreamMeta::new(80, 40, 40),
    }
}
