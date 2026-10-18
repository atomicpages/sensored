//! Slack incoming webhook URLs. Mirrors `token/slack-webhook-url.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "slack_webhook_url",
        entity_type: "slack_webhook_url",
        replacement: "[SLACK_WEBHOOK_URL]",
        pattern: LazyLock::new(|| {
            regex(r"https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]{23,25}")
        }),
        validate: |_| Some(&["slack_webhook_url.format"]),
        stream: StreamMeta::new(120, 0, 0),
    }
}
