//! Config validation and policy resolution. Mirrors `policy.ts`,
//! `presets.ts` and `validate.ts`.
//!
//! Owner: phase 1 agent (a). Signatures are the contract; do not change them.

use std::collections::HashSet;

use indexmap::IndexMap;

use crate::detectors::Registry;
use crate::errors::Result;
use crate::types::{ActiveRule, RuleSetting};

/// Default complete-string limit, in UTF-16 code units. Mirrors `MAX_INPUT_LENGTH`.
pub const MAX_INPUT_LENGTH: usize = 1_048_576;

#[derive(Debug, Clone)]
pub struct ResolvedPolicy {
    /// Rule id to setting, in TS resolution order (preset rules, then explicit).
    pub policy: IndexMap<String, RuleSetting>,
    /// Enabled rules, same order as `policy`.
    pub rules: Vec<ActiveRule>,
    pub allowlist: HashSet<String>,
    pub detect_only: bool,
    pub restore: bool,
    /// UTF-16 code units.
    pub max_input_length: usize,
}

/// Validates a JSON config and resolves it against `registry`.
///
/// The config is the JSON-only `RedactorConfig` (see `conformance/types.ts`),
/// plus `detectors`: metadata-only descriptors for the caller's JS detectors,
/// registered as `ExternalDetector`s.
pub fn resolve_policy(config: &serde_json::Value, registry: &Registry) -> Result<ResolvedPolicy> {
    let _ = (config, registry);
    todo!("phase 1 agent (a)")
}
