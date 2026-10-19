//! Config shape and rule-setting validation. Mirrors `validate.ts`.
//!
//! Checks run in the TS order, so the first error has the same code and path.

use std::collections::HashSet;

use indexmap::IndexMap;
use serde_json::{Map, Value};

use super::json::{
    has_only_keys, invalid, is_identifier, js_entries, non_empty_str, non_negative_integer,
    safe_integer,
};
use crate::errors::Result;
use crate::types::{MaskPreserve, RuleSetting};

/// Top-level keys. `semantic` is TS-only (the wrapper strips it), so it is
/// rejected here as an unknown key.
const CONFIG_KEYS: &[&str] = &[
    "presets",
    "customPresets",
    "rules",
    "limits",
    "detectors",
    "restore",
    "allowlist",
    "detectOnly",
    "detectorOptions",
];

/// A custom preset's enabled rules, in order. `"off"` entries are dropped,
/// as preset merging skips them.
pub(super) type PresetRules = Vec<(String, RuleSetting)>;

/// A config whose shape `validateConfigShape` accepts. Checks that TS runs
/// later in `resolvePolicy` (limits, detectors, rule settings) are deferred
/// so errors keep their TS order.
pub(super) struct Config<'a> {
    pub rules: &'a Map<String, Value>,
    pub presets: Option<Vec<&'a str>>,
    pub custom_presets: IndexMap<String, PresetRules>,
    pub restore: bool,
    pub detect_only: bool,
    pub allowlist: HashSet<String>,
    pub limits: Option<&'a Value>,
    pub detectors: Option<&'a Value>,
    /// `detectorOptions.http_auth_header.customHeaders`.
    pub custom_headers: Option<Vec<String>>,
}

/// Mirrors `validateConfigShape`.
pub(super) fn parse_config(config: &Value) -> Result<Config<'_>> {
    let root = config.as_object().ok_or_else(|| invalid("rules"))?;

    if !has_only_keys(root, CONFIG_KEYS) {
        return Err(invalid("rules"));
    }

    let rules = root
        .get("rules")
        .and_then(Value::as_object)
        .ok_or_else(|| invalid("rules"))?;

    let presets = root.get("presets").map(parse_presets).transpose()?;
    let custom_presets = root
        .get("customPresets")
        .map(parse_custom_presets)
        .transpose()?;
    let restore = optional_bool(root, "restore")?;
    let detect_only = optional_bool(root, "detectOnly")?;
    let allowlist = root.get("allowlist").map(parse_allowlist).transpose()?;
    let custom_headers = root
        .get("detectorOptions")
        .map(parse_detector_options)
        .transpose()?;

    Ok(Config {
        rules,
        presets,
        custom_presets: custom_presets.unwrap_or_default(),
        restore,
        detect_only,
        allowlist: allowlist.unwrap_or_default(),
        limits: root.get("limits"),
        detectors: root.get("detectors"),
        custom_headers: custom_headers.flatten(),
    })
}

fn optional_bool(root: &Map<String, Value>, key: &str) -> Result<bool> {
    match root.get(key) {
        None => Ok(false),
        Some(value) => value.as_bool().ok_or_else(|| invalid(key)),
    }
}

/// Non-empty strings, or an error at `path`.
fn non_empty_strings<'a>(value: &'a Value, path: &str) -> Result<Vec<&'a str>> {
    let items = value.as_array().ok_or_else(|| invalid(path))?;

    items
        .iter()
        .map(|item| non_empty_str(item).ok_or_else(|| invalid(path)))
        .collect()
}

fn parse_presets(value: &Value) -> Result<Vec<&str>> {
    non_empty_strings(value, "presets")
}

fn parse_allowlist(value: &Value) -> Result<HashSet<String>> {
    let items = non_empty_strings(value, "allowlist")?;

    Ok(items.into_iter().map(str::to_owned).collect())
}

fn parse_custom_presets(value: &Value) -> Result<IndexMap<String, PresetRules>> {
    let presets = value.as_object().ok_or_else(|| invalid("customPresets"))?;
    let mut parsed = IndexMap::new();

    for (name, rules) in js_entries(presets) {
        if !is_identifier(name, true) {
            return Err(invalid("customPresets"));
        }

        let rules = rules.as_object().ok_or_else(|| invalid("customPresets"))?;

        parsed.insert(name.to_owned(), parse_preset_rules(rules)?);
    }

    Ok(parsed)
}

fn parse_preset_rules(rules: &Map<String, Value>) -> Result<PresetRules> {
    let mut parsed = Vec::new();

    for (rule_id, value) in js_entries(rules) {
        if rule_id.is_empty() {
            return Err(invalid("customPresets"));
        }

        if value == "off" {
            continue;
        }

        parsed.push((rule_id.to_owned(), parse_setting(value)?));
    }

    Ok(parsed)
}

/// Returns the validated custom headers, or `None` when not configured.
fn parse_detector_options(value: &Value) -> Result<Option<Vec<String>>> {
    let options = value
        .as_object()
        .ok_or_else(|| invalid("detectorOptions"))?;

    if !has_only_keys(options, &["http_auth_header"]) {
        return Err(invalid("detectorOptions"));
    }

    let Some(http_auth_header) = options.get("http_auth_header") else {
        return Ok(None);
    };

    let path = "detectorOptions.http_auth_header";
    let http_auth_header = http_auth_header.as_object().ok_or_else(|| invalid(path))?;

    if !has_only_keys(http_auth_header, &["customHeaders"]) {
        return Err(invalid(path));
    }

    let Some(headers) = http_auth_header.get("customHeaders") else {
        return Ok(None);
    };

    // JSON carries only the string form; TS resolves `RegExp` entries itself.
    let path = "detectorOptions.http_auth_header.customHeaders";
    let headers = non_empty_strings(headers, path)?;

    if headers.is_empty() {
        return Err(invalid(path));
    }

    Ok(Some(headers.into_iter().map(str::to_owned).collect()))
}

/// Mirrors `validateLimits`. Returns `maxInputLength` in UTF-16 units.
pub(super) fn parse_limits(value: &Value) -> Result<Option<usize>> {
    let path = "limits.maxInputLength";
    let limits = value.as_object().ok_or_else(|| invalid(path))?;

    if !has_only_keys(limits, &["maxInputLength"]) {
        return Err(invalid(path));
    }

    let Some(max) = limits.get("maxInputLength") else {
        return Ok(None);
    };

    let max = non_negative_integer(max)
        .filter(|&max| max > 0)
        .ok_or_else(|| invalid(path))?;

    // Saturates on 32-bit targets, where no input can exceed `usize::MAX`.
    Ok(Some(usize::try_from(max).unwrap_or(usize::MAX)))
}

// ---------------------------------------------------------------------------
// Rule settings
// ---------------------------------------------------------------------------

/// Mirrors `validateSetting`, then builds the typed setting. Errors are at
/// `rules`, wherever the setting came from.
pub(super) fn parse_setting(value: &Value) -> Result<RuleSetting> {
    let setting = value.as_object().ok_or_else(|| invalid("rules"))?;
    let action = setting.get("action").and_then(Value::as_str);

    let allowed: &[&str] = match action {
        Some("redact") => &["action", "replacement", "priority"],
        Some("token-replace") => &["action", "tokens"],
        Some("mask") => &["action", "preserve"],
        Some("format-preserve" | "remove") => &["action"],
        _ => return Err(invalid("rules")),
    };

    if !has_only_keys(setting, allowed) {
        return Err(invalid("rules"));
    }

    match action {
        Some("redact") => parse_redact(setting),
        Some("token-replace") => parse_token_replace(setting),
        Some("mask") => parse_mask(setting),
        Some("format-preserve") => Ok(RuleSetting::FormatPreserve),
        _ => Ok(RuleSetting::Remove),
    }
}

/// Applies `parse` to `setting[key]` when present; any failure is at `rules`.
fn optional_field<'a, T>(
    setting: &'a Map<String, Value>,
    key: &str,
    parse: impl FnOnce(&'a Value) -> Option<T>,
) -> Result<Option<T>> {
    match setting.get(key) {
        None => Ok(None),
        Some(value) => parse(value).map(Some).ok_or_else(|| invalid("rules")),
    }
}

fn parse_redact(setting: &Map<String, Value>) -> Result<RuleSetting> {
    let replacement = optional_field(setting, "replacement", |v| v.as_str().map(str::to_owned))?;
    let priority = optional_field(setting, "priority", safe_integer)?;

    Ok(RuleSetting::Redact {
        replacement,
        priority,
    })
}

fn parse_token_replace(setting: &Map<String, Value>) -> Result<RuleSetting> {
    let tokens = optional_field(setting, "tokens", parse_tokens)?;

    Ok(RuleSetting::TokenReplace { tokens })
}

/// Non-empty keys to string values, in `Object.entries` order.
fn parse_tokens(value: &Value) -> Option<IndexMap<String, String>> {
    js_entries(value.as_object()?)
        .into_iter()
        .map(|(key, token)| {
            let token = token.as_str()?;

            (!key.is_empty()).then(|| (key.to_owned(), token.to_owned()))
        })
        .collect()
}

fn parse_mask(setting: &Map<String, Value>) -> Result<RuleSetting> {
    let preserve = optional_field(setting, "preserve", parse_preserve)?;

    Ok(RuleSetting::Mask { preserve })
}

fn parse_preserve(value: &Value) -> Option<MaskPreserve> {
    let preserve = value.as_object()?;

    if !has_only_keys(preserve, &["first", "last"]) {
        return None;
    }

    let count = |key: &str| match preserve.get(key) {
        None => Some(None),
        Some(value) => non_negative_integer(value).map(Some),
    };

    Some(MaskPreserve {
        first: count("first")?,
        last: count("last")?,
    })
}
