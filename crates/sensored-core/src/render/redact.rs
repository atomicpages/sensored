//! Mirrors `resolveRedaction` in `render/redact.ts`.

use crate::types::{AppliedMatch, RuleSetting};

const FALLBACK: &str = "[REDACTED]";

/// The replacement the highest-priority redact matches agree on. A rule's
/// `replacement` overrides its detector's default; when the winners disagree,
/// `[REDACTED]` keeps the output deterministic.
pub(super) fn render(winners: &[&AppliedMatch<'_>]) -> String {
    let mut replacements = winners.iter().map(|applied| match &applied.rule.setting {
        RuleSetting::Redact {
            replacement: Some(replacement),
            ..
        } => replacement.as_str(),
        _ => applied.rule.detector.replacement(),
    });

    let Some(first) = replacements.next() else {
        return FALLBACK.to_owned();
    };

    if replacements.all(|replacement| replacement == first) {
        first.to_owned()
    } else {
        FALLBACK.to_owned()
    }
}
