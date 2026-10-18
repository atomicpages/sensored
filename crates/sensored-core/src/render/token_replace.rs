//! Mirrors `render/token-replace.ts`.

use crate::hash::fnv1a32;
use crate::token_generators::default_token;
use crate::types::{AppliedMatch, RuleSetting};

/// Deterministic fake data for the group. A custom token for the entity type
/// wins over the default; without either, a hash of the original text.
pub(super) fn render(
    text: &str,
    matches: &[&AppliedMatch<'_>],
    start: usize,
    end: usize,
) -> String {
    let original = &text[start..end];
    let entity_type = matches
        .first()
        .map_or("REDACTED", |applied| applied.rule.detector.entity_type());

    let custom = matches
        .iter()
        .find_map(|applied| match &applied.rule.setting {
            RuleSetting::TokenReplace {
                tokens: Some(tokens),
            } => tokens.get(entity_type),
            _ => None,
        });

    if let Some(token) = custom {
        return token.clone();
    }

    if let Some(token) = default_token(entity_type) {
        return token.to_owned();
    }

    format!("[REDACTED_{:08X}]", fnv1a32(original))
}
