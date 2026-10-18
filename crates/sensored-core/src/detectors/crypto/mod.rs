//! Built-in `crypto` detectors. Mirrors `packages/sensored/src/detectors/crypto/`.

use std::sync::Arc;

use super::Registry;

mod crypto_address;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(crypto_address::CryptoAddressDetector));
}
