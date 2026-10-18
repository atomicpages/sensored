//! Mailchimp API keys. Mirrors `token/mailchimp-api-key.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "mailchimp_api_key",
        entity_type: "mailchimp_api_key",
        replacement: "[MAILCHIMP_API_KEY]",
        pattern: LazyLock::new(|| regex(r"[0-9a-f]{32}-us[0-9]{1,2}")),
        validate: |_| Some(&["mailchimp_api_key.format"]),
        stream: StreamMeta::new(40, 0, 0),
    }
}
