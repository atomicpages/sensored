//! Anthropic API keys. Mirrors `token/anthropic-api-key.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "anthropic_api_key",
        entity_type: "anthropic_api_key",
        replacement: "[ANTHROPIC_API_KEY]",
        // JS `/sk-ant-(?:admin01|api03)-[\w-]{93}AA/g`: `\w` is ASCII.
        pattern: LazyLock::new(|| regex(r"sk-ant-(?:admin01|api03)-[A-Za-z0-9_-]{93}AA")),
        validate: |_| Some(&["anthropic_api_key.format"]),
        stream: StreamMeta::new(110, 0, 0),
    }
}
