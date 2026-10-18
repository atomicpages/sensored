//! Datadog API keys, near a keyword. Mirrors `token/datadog-api-key.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{KeywordDetector, StreamMeta};

pub(super) fn detector() -> KeywordDetector {
    KeywordDetector {
        id: "datadog_api_key",
        entity_type: "datadog_api_key",
        replacement: "[DATADOG_API_KEY]",
        pattern: LazyLock::new(|| regex(r"[a-zA-Z0-9]{40}|[a-zA-Z0-9]{32}")),
        keywords: &["datadog", "dd"],
        stream: StreamMeta::new(40, 40, 40),
    }
}
