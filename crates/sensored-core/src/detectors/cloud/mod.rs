//! Built-in `cloud` detectors. Mirrors `packages/sensored/src/detectors/cloud/`.
//!
//! Each TS `detect` is the checksum pipeline with no check (match, adjacency,
//! push), so every detector is a `ChecksumDetector` whose `validate` always
//! returns the TS `<id>.format` reason. See `CONTEXT.md`.

use std::sync::Arc;

use super::{Registry, regex};

mod aws_access_key;
mod cloudflare_api_token;
mod digitalocean_token;
mod google_api_key;
mod slack_token;
mod stripe_api_key;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(aws_access_key::detector()));
    registry.insert(Arc::new(google_api_key::detector()));
    registry.insert(Arc::new(slack_token::detector()));
    registry.insert(Arc::new(stripe_api_key::detector()));
    registry.insert(Arc::new(cloudflare_api_token::detector()));
    registry.insert(Arc::new(digitalocean_token::detector()));
}

#[cfg(test)]
mod test_support {
    use crate::detector::Detector;

    pub use crate::detectors::test_support::*;

    /// Every `rejected` input yields nothing; every `found` input yields
    /// exactly its expected value.
    pub fn assert_cases(detector: &dyn Detector, found: &[(&str, &str)], rejected: &[&str]) {
        for (input, expected) in found {
            assert_eq!(values(detector, input), [*expected], "{input}");
        }

        for input in rejected {
            assert!(values(detector, input).is_empty(), "{input}");
        }
    }
}
