//! Sentry auth tokens. Mirrors `token/sentry-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "sentry_token",
        entity_type: "sentry_token",
        replacement: "[SENTRY_TOKEN]",
        pattern: LazyLock::new(|| regex(r"sntrys_eyJ[a-zA-Z0-9=_+/]{197}|sntryu_[a-f0-9]{64}")),
        validate: |_| Some(&["sentry_token.format"]),
        stream: StreamMeta::new(210, 0, 0),
    }
}
