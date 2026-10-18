//! The detector registry. Mirrors `detectors/registry.ts`.
//!
//! Each detector family owns a module with a `register` function; `builtins`
//! wires them in once, so parallel family ports never edit the same lines.

use std::sync::Arc;

use indexmap::IndexMap;

use crate::detector::Detector;

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

/// All built-in detectors. Families are wired in during phases 2 and 3.
pub fn builtins() -> Registry {
    Registry::default()
}
