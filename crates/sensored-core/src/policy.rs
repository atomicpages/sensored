//! Config validation and policy resolution. Mirrors `policy.ts`,
//! `presets.ts` and `validate.ts`.
//!
//! Owner: phase 1 agent (a). Signatures are the contract; do not change them.

mod descriptor;
mod json;
mod presets;
mod validate;

use std::borrow::Cow;
use std::collections::HashSet;
use std::sync::Arc;

use indexmap::IndexMap;
use serde_json::Value;

use crate::detectors::Registry;
use crate::errors::{ErrorCode, Result, SensoredError};
use crate::types::{ActiveRule, RuleSetting};

use self::json::{invalid, js_entries};
use self::validate::{Config, parse_config, parse_limits, parse_setting};

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
    let config = parse_config(config)?;

    if config.detect_only && config.restore {
        return Err(invalid("detectOnly"));
    }

    let max_input_length = match config.limits {
        Some(limits) => parse_limits(limits)?,
        None => None,
    };

    let registry = with_config_detectors(registry, &config)?;
    let (policy, rules) = resolve_rules(&config, &registry)?;

    Ok(ResolvedPolicy {
        policy,
        rules,
        allowlist: config.allowlist,
        detect_only: config.detect_only,
        restore: config.restore,
        max_input_length: max_input_length.unwrap_or(MAX_INPUT_LENGTH),
    })
}

/// `registry` plus the config's detector options and external detectors.
/// Borrowed when the config adds nothing.
fn with_config_detectors<'r>(
    registry: &'r Registry,
    config: &Config<'_>,
) -> Result<Cow<'r, Registry>> {
    let mut registry = Cow::Borrowed(registry);

    if let Some(_custom_headers) = &config.custom_headers {
        // TODO(phase 3): replace `http_auth_header` with a detector built from
        // `_custom_headers`, as `policy.ts` does with `buildHttpAuthHeaderPattern`.
    }

    let Some(detectors) = config.detectors else {
        return Ok(registry);
    };

    let descriptors = detectors.as_array().ok_or_else(|| invalid("detectors"))?;

    for value in descriptors {
        let detector = descriptor::parse_descriptor(value)?;

        if registry.contains(&detector.id) {
            return Err(invalid("detectors"));
        }

        registry.to_mut().insert(Arc::new(detector));
    }

    Ok(registry)
}

/// A rule awaiting resolution. Preset settings are already validated;
/// explicit ones are checked after the rule id, as TS does.
enum Pending<'a> {
    Preset(RuleSetting),
    Explicit(&'a Value),
}

/// Expands presets, applies explicit rules on top, and resolves each rule
/// against `registry`. Mirrors the second half of `resolvePolicy`.
fn resolve_rules(
    config: &Config<'_>,
    registry: &Registry,
) -> Result<(IndexMap<String, RuleSetting>, Vec<ActiveRule>)> {
    let preset_rules = match &config.presets {
        Some(presets) => presets::resolve_presets(presets, &config.custom_presets, config.rules)?,
        None => IndexMap::new(),
    };

    // An explicit rule keeps its preset position, as JS key assignment does.
    let mut effective: IndexMap<String, Pending<'_>> = preset_rules
        .into_iter()
        .map(|(id, setting)| (id, Pending::Preset(setting)))
        .collect();

    for (id, value) in js_entries(config.rules) {
        effective.insert(id.to_owned(), Pending::Explicit(value));
    }

    let mut policy = IndexMap::new();
    let mut rules = Vec::new();

    for (id, pending) in effective {
        let detector = registry
            .get(&id)
            .ok_or_else(|| SensoredError::at(ErrorCode::UnknownRule, "rules"))?;

        let setting = match pending {
            Pending::Preset(setting) => setting,
            Pending::Explicit(value) if value == "off" => continue,
            Pending::Explicit(value) => parse_setting(value)?,
        };

        policy.insert(id, setting.clone());
        rules.push(ActiveRule {
            detector: Arc::clone(detector),
            setting,
        });
    }

    if rules.is_empty() {
        return Err(SensoredError::at(ErrorCode::EmptyPolicy, "rules"));
    }

    Ok((policy, rules))
}
