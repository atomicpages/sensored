//! Replacement rendering. Mirrors `render/*.ts`.
//!
//! Owner: phase 1 agent (b). Signatures are the contract; do not change them.

use crate::types::{AppliedMatch, RestorationContext};

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
    let _ = (text, matches, start, end, restoration);
    todo!("phase 1 agent (b)")
}
