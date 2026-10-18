//! Linear API keys. Mirrors `token/linear-api-key.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "linear_api_key",
        entity_type: "linear_api_key",
        replacement: "[LINEAR_API_KEY]",
        pattern: LazyLock::new(|| regex(r"lin_api_[0-9A-Za-z]{40}")),
        validate: |_| Some(&["linear_api_key.format"]),
        stream: StreamMeta::new(48, 0, 0),
    }
}
