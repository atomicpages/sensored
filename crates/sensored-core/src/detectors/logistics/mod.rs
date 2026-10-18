//! Built-in `logistics` detectors. Mirrors `packages/sensored/src/detectors/logistics/`.

use std::sync::Arc;

use super::Registry;

mod tracking_number;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(tracking_number::detector()));
}
