//! PagerDuty API tokens, near a keyword. Mirrors `token/pagerduty-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{KeywordDetector, StreamMeta};

pub(super) fn detector() -> KeywordDetector {
    KeywordDetector {
        id: "pagerduty_token",
        entity_type: "pagerduty_token",
        replacement: "[PAGERDUTY_TOKEN]",
        pattern: LazyLock::new(|| regex(r"[A-Za-z][A-Za-z0-9_+]{19}")),
        keywords: &["pagerduty", "pager_duty", "pd_", "pd-"],
        stream: StreamMeta::new(20, 40, 40),
    }
}
