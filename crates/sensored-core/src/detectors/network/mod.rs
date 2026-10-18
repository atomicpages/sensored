//! Built-in `network` detectors. Mirrors `packages/sensored/src/detectors/network/`.
//!
//! One file per detector; see `CONTEXT.md`.

use std::sync::Arc;

use super::{Registry, regex};
use crate::types::Detection;

mod ipv4;
mod ipv6;
mod mac_address;
mod url_query_key;
mod url_with_auth;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(ipv4::detector()));
    registry.insert(Arc::new(ipv6::detector()));
    registry.insert(Arc::new(mac_address::MacAddressDetector));
    registry.insert(Arc::new(url_query_key::UrlQueryKeyDetector));
    registry.insert(Arc::new(url_with_auth::UrlWithAuthDetector));
}

/// A `<id>.format` detection whose rule id and entity type are both `id`.
fn format_detection(id: &str, start: usize, end: usize) -> Detection {
    Detection {
        start,
        end,
        rule_id: id.to_owned(),
        entity_type: id.to_owned(),
        reasons: vec![format!("{id}.format")],
    }
}

#[cfg(test)]
use super::test_support;
