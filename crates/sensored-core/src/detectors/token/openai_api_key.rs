//! OpenAI API keys. Mirrors `token/openai-api-key.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "openai_api_key",
        entity_type: "openai_api_key",
        replacement: "[OPENAI_API_KEY]",
        pattern: LazyLock::new(|| regex(r"sk-[a-zA-Z0-9_-]+T3BlbkFJ[a-zA-Z0-9_-]+")),
        validate: |_| Some(&["openai_api_key.format"]),
        stream: StreamMeta::new(200, 0, 0),
    }
}
