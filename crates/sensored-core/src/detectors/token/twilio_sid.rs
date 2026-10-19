//! Twilio account SIDs. Mirrors `token/twilio-sid.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "twilio_sid",
        entity_type: "twilio_sid",
        replacement: "[TWILIO_SID]",
        pattern: LazyLock::new(|| regex(r"AC[0-9a-f]{32}")),
        validate: |_| Some(&["twilio_sid.format"]),
        stream: StreamMeta::new(34, 0, 0),
    }
}
