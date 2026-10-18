//! The detector registry. Mirrors `detectors/registry.ts`.
//!
//! Each detector family owns a module with a `register` function; `builtins`
//! wires them in once, so parallel family ports never edit the same lines.

use std::sync::{Arc, LazyLock};

use indexmap::IndexMap;
use regex::Regex;

use crate::detector::Detector;

pub mod cloud;
pub mod contact;
pub mod crypto;
pub mod financial;
pub mod healthcare;
pub mod hr;
pub mod identity;
pub mod legal;
pub mod logistics;
pub mod national_id;
pub mod network;
pub mod person;
pub mod token;

/// Detectors by rule id, in registration order.
#[derive(Clone, Default)]
pub struct Registry {
    detectors: IndexMap<String, Arc<dyn Detector>>,
}

impl Registry {
    /// Adds a detector, replacing any with the same id.
    pub fn insert(&mut self, detector: Arc<dyn Detector>) {
        self.detectors.insert(detector.id().to_owned(), detector);
    }

    pub fn get(&self, id: &str) -> Option<&Arc<dyn Detector>> {
        self.detectors.get(id)
    }

    pub fn contains(&self, id: &str) -> bool {
        self.detectors.contains_key(id)
    }

    pub fn iter(&self) -> impl Iterator<Item = &Arc<dyn Detector>> {
        self.detectors.values()
    }

    pub fn len(&self) -> usize {
        self.detectors.len()
    }

    pub fn is_empty(&self) -> bool {
        self.detectors.is_empty()
    }
}

/// All built-in detectors, built once and shared.
///
/// Order only affects listing (rules follow policy order); matching the TS
/// `listDetectors()` order is a phase 4 task.
pub fn builtins() -> Registry {
    static BUILTINS: LazyLock<Registry> = LazyLock::new(|| {
        let mut registry = Registry::default();

        contact::register(&mut registry);
        financial::register(&mut registry);
        national_id::register(&mut registry);
        identity::register(&mut registry);
        person::register(&mut registry);
        network::register(&mut registry);
        cloud::register(&mut registry);
        token::register(&mut registry);
        logistics::register(&mut registry);
        healthcare::register(&mut registry);
        hr::register(&mut registry);
        legal::register(&mut registry);
        crypto::register(&mut registry);

        registry
    });

    BUILTINS.clone()
}

// ---------------------------------------------------------------------------
// Helpers shared by the family modules
// ---------------------------------------------------------------------------

/// Compiles a static detector pattern.
///
/// # Panics
/// If `pattern` does not compile; patterns are static detector data.
pub(crate) fn regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("valid pattern")
}

/// TS `/\d/.test(candidate)`: whether any ASCII digit is present.
pub(crate) fn has_ascii_digit(candidate: &str) -> bool {
    candidate.bytes().any(|byte| byte.is_ascii_digit())
}

#[cfg(test)]
pub(crate) mod test_support {
    use crate::detector::Detector;
    use crate::types::Detection;

    pub fn detect(detector: &dyn Detector, text: &str) -> Vec<Detection> {
        let mut out = Vec::new();
        detector.detect(text, &mut out);

        out
    }

    /// The byte spans, in order.
    pub fn spans(detector: &dyn Detector, text: &str) -> Vec<(usize, usize)> {
        detect(detector, text)
            .iter()
            .map(|d| (d.start, d.end))
            .collect()
    }

    /// The matched substrings, in order.
    pub fn values<'a>(detector: &dyn Detector, text: &'a str) -> Vec<&'a str> {
        detect(detector, text)
            .iter()
            .map(|d| &text[d.start..d.end])
            .collect()
    }
}
