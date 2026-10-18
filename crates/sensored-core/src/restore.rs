//! Mirrors `restore.ts` and `placeholders.ts`.

use std::sync::LazyLock;

use regex::{Captures, Regex};

use crate::types::RestorationMap;

/// `PLACEHOLDER_PATTERN` from `placeholders.ts`, with JS's ASCII `\d`.
static PLACEHOLDER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[[A-Z][A-Z0-9_]*_[0-9]+\]").expect("valid pattern"));

/// Replaces numbered placeholders found in `map` with their originals.
///
/// Unknown placeholders stay as they are. Values are inserted literally (TS
/// uses a function replacer, so `$&` and friends are not expanded) and are
/// never rescanned.
pub fn restore(text: &str, map: &RestorationMap) -> String {
    PLACEHOLDER
        .replace_all(text, |caps: &Captures| {
            let placeholder = &caps[0];

            map.get(placeholder)
                .map_or(placeholder, String::as_str)
                .to_owned()
        })
        .into_owned()
}
