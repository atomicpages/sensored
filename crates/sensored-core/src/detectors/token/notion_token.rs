//! Notion integration tokens. Mirrors `token/notion-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "notion_token",
        entity_type: "notion_token",
        replacement: "[NOTION_TOKEN]",
        pattern: LazyLock::new(|| regex(r"(?:secret_|ntn_)[A-Za-z0-9]{43}")),
        validate: |_| Some(&["notion_token.format"]),
        stream: StreamMeta::new(50, 0, 0),
    }
}
