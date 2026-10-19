//! Heroku API keys. Mirrors `token/heroku-api-key.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "heroku_api_key",
        entity_type: "heroku_api_key",
        replacement: "[HEROKU_API_KEY]",
        pattern: LazyLock::new(|| regex(r"HRKU-[0-9a-zA-Z_-]{60}")),
        validate: |_| Some(&["heroku_api_key.format"]),
        stream: StreamMeta::new(65, 0, 0),
    }
}
