//! SendGrid API keys. Mirrors `token/sendgrid-api-key.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "sendgrid_api_key",
        entity_type: "sendgrid_api_key",
        replacement: "[SENDGRID_API_KEY]",
        // JS `/SG\.[\w-]{20,24}\.[\w-]{39,50}/g`: `\w` is ASCII.
        pattern: LazyLock::new(|| regex(r"SG\.[A-Za-z0-9_-]{20,24}\.[A-Za-z0-9_-]{39,50}")),
        validate: |_| Some(&["sendgrid_api_key.format"]),
        stream: StreamMeta::new(100, 0, 0),
    }
}
