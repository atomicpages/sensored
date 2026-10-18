//! Built-in `healthcare` detectors. Mirrors `packages/sensored/src/detectors/healthcare/`.

use std::sync::Arc;

use super::Registry;

mod health_insurance_id;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(health_insurance_id::detector()));
}
