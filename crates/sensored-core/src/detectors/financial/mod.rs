//! Built-in `financial` detectors. Mirrors `packages/sensored/src/detectors/financial/`.

use std::sync::Arc;

use super::Registry;

mod payment_card;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(payment_card::detector()));
}
