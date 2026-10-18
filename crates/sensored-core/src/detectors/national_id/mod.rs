//! Built-in `national-id` detectors. Mirrors `packages/sensored/src/detectors/national-id/`.
//!
//! One file per detector; see `CONTEXT.md` for the porting recipe.

use std::sync::Arc;

use regex::Regex;

use super::Registry;

mod au_tfn;
mod fj_id;
mod ma_id;
mod png_id;
mod to_id;
mod uk_nino;
mod uz_stir;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(au_tfn::detector()));
    registry.insert(Arc::new(fj_id::detector()));
    registry.insert(Arc::new(ma_id::detector()));
    registry.insert(Arc::new(png_id::detector()));
    registry.insert(Arc::new(to_id::detector()));
    registry.insert(Arc::new(uk_nino::detector()));
    registry.insert(Arc::new(uz_stir::detector()));
}

/// Compiles a static detector pattern.
///
/// # Panics
/// If `pattern` does not compile; patterns are static detector data.
fn regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("valid pattern")
}

#[cfg(test)]
mod test_support {
    use crate::detector::Detector;
    use crate::types::Detection;

    pub fn detect(detector: &dyn Detector, text: &str) -> Vec<Detection> {
        let mut out = Vec::new();
        detector.detect(text, &mut out);

        out
    }

    /// The matched substrings, in order.
    pub fn values<'a>(detector: &dyn Detector, text: &'a str) -> Vec<&'a str> {
        detect(detector, text)
            .iter()
            .map(|d| &text[d.start..d.end])
            .collect()
    }

    /// The byte spans, in order.
    pub fn spans(detector: &dyn Detector, text: &str) -> Vec<(usize, usize)> {
        detect(detector, text)
            .iter()
            .map(|d| (d.start, d.end))
            .collect()
    }

    /// The label-placement cases every `ContextDetector` test in TS repeats:
    /// `value` is found next to `label` and rejected without it.
    pub fn assert_context_shape(detector: &dyn Detector, label: &str, value: &str) {
        let lower = label.to_lowercase();
        let upper = label.to_uppercase();

        let found = [
            format!("{label}: {value}"),
            format!("{lower}: {value}"),
            format!("{upper}: {value}"),
            format!("{label}:{value}"),
            format!("{label}# {value}"),
            format!("{label}#{value}"),
            format!("{label}:\t{value}"),
            format!("{label}: \t {value}"),
            format!("{value} ({label})"),
            format!("{value} {label}"),
            format!("{value}\t({label})"),
            format!("{label}: {value}."),
            format!("({label}: {value})"),
        ];

        for text in &found {
            assert_eq!(values(detector, text), [value], "{text:?}");
        }

        let missed = [
            value.to_owned(),
            format!("Reference: {value}"),
            format!("my{label}: {value}"),
            format!("{label}x: {value}"),
            format!("{label}:\n{value}"),
            format!("{label}:         {value}"),
            format!("{value}({label})"),
            format!("{value} ({label}"),
            format!("{label}: {value}_"),
            format!("_{label}: {value}"),
            format!("{label}: {value}\u{301}"),
        ];

        for text in &missed {
            assert!(values(detector, text).is_empty(), "{text:?}");
        }
    }
}
