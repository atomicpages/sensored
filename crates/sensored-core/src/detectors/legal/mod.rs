//! Built-in `legal` detectors. Mirrors `packages/sensored/src/detectors/legal/`.
//!
//! One file per detector; the porting recipe is in `national_id/CONTEXT.md`.

use std::sync::Arc;

use regex::Regex;

use super::Registry;

mod legal_case;
mod legal_license;
mod legal_reference;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(legal_case::detector()));
    registry.insert(Arc::new(legal_license::detector()));
    registry.insert(Arc::new(legal_reference::detector()));
}

/// Compiles a static detector pattern.
///
/// # Panics
/// If `pattern` does not compile; patterns are static detector data.
fn regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("valid pattern")
}

/// TS `/\d/.test(candidate)`: JS `\d` is ASCII.
fn has_digit(candidate: &str) -> bool {
    candidate.bytes().any(|b| b.is_ascii_digit())
}

#[cfg(test)]
mod test_support {
    use crate::detector::Detector;

    /// The matched substrings, in order.
    pub fn values<'a>(detector: &dyn Detector, text: &'a str) -> Vec<&'a str> {
        let mut out = Vec::new();
        detector.detect(text, &mut out);

        out.iter().map(|d| &text[d.start..d.end]).collect()
    }
}
