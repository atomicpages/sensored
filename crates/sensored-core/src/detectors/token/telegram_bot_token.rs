//! Telegram bot tokens. Mirrors `token/telegram-bot-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "telegram_bot_token",
        entity_type: "telegram_bot_token",
        replacement: "[TELEGRAM_BOT_TOKEN]",
        pattern: LazyLock::new(|| regex(r"[0-9]+:AA[a-zA-Z0-9_-]{35}")),
        validate: |_| Some(&["telegram_bot_token.format"]),
        stream: StreamMeta::new(60, 0, 0),
    }
}
