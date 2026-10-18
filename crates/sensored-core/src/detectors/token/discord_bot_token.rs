//! Discord bot tokens, near a keyword. Mirrors `token/discord-bot-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{KeywordDetector, StreamMeta};

pub(super) fn detector() -> KeywordDetector {
    KeywordDetector {
        id: "discord_bot_token",
        entity_type: "discord_bot_token",
        replacement: "[DISCORD_BOT_TOKEN]",
        pattern: LazyLock::new(|| regex(r"[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}")),
        keywords: &["discord"],
        stream: StreamMeta::new(60, 40, 40),
    }
}
