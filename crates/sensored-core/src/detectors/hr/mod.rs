//! Built-in `hr` detectors. Mirrors `packages/sensored/src/detectors/hr/`.
//!
//! One file per detector; the porting recipe is in `national_id/CONTEXT.md`.

use std::sync::Arc;

use regex::Regex;

use super::Registry;

mod hr_compensation;
mod hr_identifier;
mod hr_recruitment;
mod hr_screening;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(hr_compensation::HrCompensation));
    registry.insert(Arc::new(hr_identifier::detector()));
    registry.insert(Arc::new(hr_recruitment::detector()));
    registry.insert(Arc::new(hr_screening::detector()));
}

/// Compiles a static detector pattern.
///
/// # Panics
/// If `pattern` does not compile; patterns are static detector data.
fn regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("valid pattern")
}

/// `/\d/.test(candidate)`.
fn has_ascii_digit(candidate: &str) -> bool {
    candidate.bytes().any(|byte| byte.is_ascii_digit())
}

#[cfg(test)]
mod test_support {
    use crate::detector::Detector;

    pub fn spans(detector: &dyn Detector, text: &str) -> Vec<(usize, usize)> {
        let mut out = Vec::new();
        detector.detect(text, &mut out);

        out.iter().map(|d| (d.start, d.end)).collect()
    }

    pub fn values<'a>(detector: &dyn Detector, text: &'a str) -> Vec<&'a str> {
        spans(detector, text)
            .into_iter()
            .map(|(start, end)| &text[start..end])
            .collect()
    }
}
