//! npm access tokens. Mirrors `token/npm-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "npm_token",
        entity_type: "npm_token",
        replacement: "[NPM_TOKEN]",
        pattern: LazyLock::new(|| regex(r"npm_[a-zA-Z0-9]{36}")),
        validate: |_| Some(&["npm_token.format"]),
        stream: StreamMeta::new(40, 0, 0),
    }
}
