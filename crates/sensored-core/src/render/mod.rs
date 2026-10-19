//! Replacement rendering. Mirrors `render/*.ts`.

mod format_preserve;
mod mask;
mod redact;
mod token_replace;

use crate::types::{AppliedMatch, RestorationContext, RuleSetting};

const FALLBACK_ENTITY_TYPE: &str = "REDACTED";

/// Resolves a group's replacement text. Mirrors `resolveReplacement`.
///
/// `matches` are the group's contributors, sorted by start, end, rule id.
/// `start..end` is the group span in bytes. With `restoration`, the result is
/// a numbered placeholder recorded in the context.
pub fn resolve_replacement(
    text: &str,
    matches: &[AppliedMatch<'_>],
    start: usize,
    end: usize,
    restoration: Option<&mut RestorationContext>,
) -> String {
    let winner = Winner::resolve(matches);

    if let Some(context) = restoration {
        return restoration_placeholder(&text[start..end], &winner, context);
    }

    match winner.action {
        Action::Remove => String::new(),
        Action::Redact => redact::render(&winner.matches),
        Action::FormatPreserve => format_preserve::render(text, start, end),
        Action::TokenReplace => token_replace::render(text, &winner.matches, start, end),
        Action::Mask => mask::render(text, &winner.matches, start, end),
    }
}

/// Precedence order: earlier variants win.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Action {
    Remove,
    Redact,
    FormatPreserve,
    TokenReplace,
    Mask,
}

impl Action {
    fn of(setting: &RuleSetting) -> Self {
        match setting {
            RuleSetting::Remove => Self::Remove,
            RuleSetting::Redact { .. } => Self::Redact,
            RuleSetting::FormatPreserve => Self::FormatPreserve,
            RuleSetting::TokenReplace { .. } => Self::TokenReplace,
            RuleSetting::Mask { .. } => Self::Mask,
        }
    }
}

/// The winning action and its contributing matches. Mirrors `resolveWinningAction`.
struct Winner<'m, 'a> {
    action: Action,
    matches: Vec<&'m AppliedMatch<'a>>,
}

impl<'m, 'a> Winner<'m, 'a> {
    /// Walks remove > redact > format-preserve > token-replace > mask. For
    /// redact, only the highest-priority matches win; for mask, every mask
    /// match contributes (their hidden regions union).
    fn resolve(matches: &'m [AppliedMatch<'a>]) -> Self {
        let action = matches
            .iter()
            .map(|applied| Action::of(&applied.rule.setting))
            .min_by_key(|&action| action as u8)
            .unwrap_or(Action::Mask);

        let contributors = matches
            .iter()
            .filter(|applied| Action::of(&applied.rule.setting) == action);

        let matches = if action == Action::Redact {
            highest_priority(contributors)
        } else {
            contributors.collect()
        };

        Self { action, matches }
    }

    /// The entity type a placeholder is numbered under. Mirrors
    /// `resolveWinningEntityType`: redact winners of mixed types fall back.
    fn entity_type(&self) -> &str {
        let Some(first) = self.matches.first() else {
            return FALLBACK_ENTITY_TYPE;
        };

        let entity_type = first.rule.detector.entity_type();

        let mixed = self.action == Action::Redact
            && self
                .matches
                .iter()
                .any(|applied| applied.rule.detector.entity_type() != entity_type);

        if mixed {
            FALLBACK_ENTITY_TYPE
        } else {
            entity_type
        }
    }
}

fn priority(applied: &AppliedMatch<'_>) -> i64 {
    match applied.rule.setting {
        RuleSetting::Redact { priority, .. } => priority.unwrap_or(0),
        _ => 0,
    }
}

/// Redact matches sharing the highest priority (unset counts as 0), in order.
fn highest_priority<'m, 'a>(
    redacts: impl Iterator<Item = &'m AppliedMatch<'a>>,
) -> Vec<&'m AppliedMatch<'a>> {
    let mut winners = Vec::new();
    let mut best = i64::MIN;

    for applied in redacts {
        let rank = priority(applied);

        if winners.is_empty() || rank > best {
            winners.clear();
            best = rank;
        }

        if rank == best {
            winners.push(applied);
        }
    }

    winners
}

/// Issues `[ENTITY_TYPE_N]`, numbered per upper-cased entity type, and records
/// it. With a `reverse_map` (sessions), a repeated value reuses its placeholder.
/// Mirrors `resolveRestorationPlaceholder`.
fn restoration_placeholder(
    original: &str,
    winner: &Winner<'_, '_>,
    context: &mut RestorationContext,
) -> String {
    if let Some(existing) = context
        .reverse_map
        .as_ref()
        .and_then(|reverse| reverse.get(original))
    {
        return existing.clone();
    }

    let base = winner.entity_type().to_uppercase();
    let counter = context.counters.entry(base.clone()).or_insert(0);
    *counter += 1;

    let placeholder = format!("[{base}_{counter}]");
    context.map.insert(placeholder.clone(), original.to_owned());

    if let Some(reverse) = context.reverse_map.as_mut() {
        reverse.insert(original.to_owned(), placeholder.clone());
    }

    placeholder
}
