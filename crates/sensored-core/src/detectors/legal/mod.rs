//! Built-in `legal` detectors. Mirrors `packages/sensored/src/detectors/legal/`.
//!
//! One file per detector; the porting recipe is in `national_id/CONTEXT.md`.

use std::sync::Arc;

use super::{Registry, has_ascii_digit, regex};

mod legal_case;
mod legal_license;
mod legal_reference;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(legal_case::detector()));
    registry.insert(Arc::new(legal_license::detector()));
    registry.insert(Arc::new(legal_reference::detector()));
}

#[cfg(test)]
use super::test_support;
