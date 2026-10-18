//! GitHub personal access tokens. Mirrors `token/github-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "github_token",
        entity_type: "github_token",
        replacement: "[GITHUB_TOKEN]",
        pattern: LazyLock::new(|| regex(r"gh[pousr]_[A-Za-z0-9]{36,}")),
        validate: |_| Some(&["github_token.format"]),
        stream: StreamMeta::new(255, 0, 0),
    }
}
