//! Hugging Face access tokens. Mirrors `token/huggingface-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "huggingface_token",
        entity_type: "huggingface_token",
        replacement: "[HUGGINGFACE_TOKEN]",
        pattern: LazyLock::new(|| regex(r"(?:hf_|api_org_)[a-zA-Z0-9]{34}")),
        validate: |_| Some(&["huggingface_token.format"]),
        stream: StreamMeta::new(42, 0, 0),
    }
}
