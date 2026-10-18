//! Built-in `crypto` detectors. Mirrors `packages/sensored/src/detectors/crypto/`.

use std::sync::Arc;

use super::Registry;

mod crypto_address;
mod crypto_tx_hash;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(crypto_address::CryptoAddressDetector));
    registry.insert(Arc::new(crypto_tx_hash::detector()));
}
