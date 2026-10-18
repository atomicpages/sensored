//! Shared harness for golden-fixture tests. See `conformance/types.ts` for the
//! fixture contract.
//!
//! Until detectors are ported, `stub_registry` stands in for the built-ins:
//! every TS detector's metadata as an `ExternalDetector`, so policy and
//! rendering can be tested against the recorded matches.

#![allow(dead_code)]

use std::path::PathBuf;
use std::sync::Arc;

use indexmap::IndexMap;
use sensored_core::detector::{ExternalDetector, StreamMeta};
use sensored_core::detectors::Registry;
use sensored_core::text::utf16_to_utf8;
use sensored_core::types::{MaskPreserve, RuleSetting};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

pub const GOLDEN_VERSION: u64 = 1;

#[derive(Debug, Deserialize)]
pub struct GoldenFile<Case> {
    pub version: u64,
    pub cases: Vec<Case>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Match {
    pub start: usize,
    pub end: usize,
    pub rule_id: String,
    pub entity_type: String,
    pub reasons: Vec<String>,
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub struct Group {
    pub start: usize,
    pub end: usize,
    pub replacement: String,
    pub matches: Vec<Match>,
}

#[derive(Debug, Deserialize)]
pub struct RenderExpected {
    pub text: String,
    pub groups: Vec<Group>,
    pub map: Option<IndexMap<String, String>>,
}

#[derive(Debug, Deserialize)]
pub struct RenderCase {
    pub id: String,
    pub config: Value,
    pub input: String,
    pub expected: RenderExpected,
}

#[derive(Debug, Deserialize)]
pub struct PolicyCase {
    pub id: String,
    pub config: Value,
    pub expected: PolicyExpected,
}

#[derive(Debug, Deserialize)]
pub struct PolicyExpected {
    pub policy: Value,
}

#[derive(Debug, Deserialize)]
pub struct ErrorCase {
    pub id: String,
    pub config: Value,
    pub input: Option<String>,
    pub expected: ErrorExpected,
}

#[derive(Debug, Deserialize)]
pub struct ErrorExpected {
    pub code: String,
    pub path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StreamOptions {
    pub report: bool,
    pub restore: bool,
}

#[derive(Debug, Deserialize)]
pub struct StreamExpected {
    pub text: String,
    pub detections: Vec<Group>,
    pub map: Option<IndexMap<String, String>>,
}

#[derive(Debug, Deserialize)]
pub struct StreamCase {
    pub id: String,
    pub config: Value,
    pub options: StreamOptions,
    pub input: String,
    pub expected: StreamExpected,
}

#[derive(Debug, Deserialize)]
pub struct RestoreCase {
    pub id: String,
    pub input: String,
    pub map: IndexMap<String, String>,
    pub streamed: bool,
    pub expected: String,
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// Loads `conformance/golden/<file>`.
pub fn golden<Case: DeserializeOwned>(file: &str) -> Vec<Case> {
    let path = repo_root().join("conformance/golden").join(file);
    let raw = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
    let parsed: GoldenFile<Case> =
        serde_json::from_str(&raw).unwrap_or_else(|e| panic!("{file}: {e}"));

    assert_eq!(parsed.version, GOLDEN_VERSION, "{file}: fixture version");

    parsed.cases
}

/// Every TS built-in's metadata (`tests/data/detectors.json`) as metadata-only
/// detectors that find nothing.
pub fn stub_registry() -> Registry {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Entry {
        id: String,
        entity_type: String,
        replacement: String,
        stream: Option<StreamMeta>,
    }

    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/data/detectors.json");
    let entries: Vec<Entry> =
        serde_json::from_str(&std::fs::read_to_string(path).expect("detectors.json"))
            .expect("valid detectors.json");

    let mut registry = Registry::default();

    for entry in entries {
        registry.insert(Arc::new(ExternalDetector {
            id: entry.id,
            entity_type: entry.entity_type,
            replacement: entry.replacement,
            stream: entry.stream,
            context_hint: None,
        }));
    }

    registry
}

/// Converts UTF-16 offsets recorded in a fixture to byte offsets in `text`.
pub fn to_bytes(text: &str, offsets: &[usize]) -> Vec<usize> {
    let mut order: Vec<usize> = (0..offsets.len()).collect();
    order.sort_by_key(|&i| offsets[i]);

    let mut sorted: Vec<usize> = order.iter().map(|&i| offsets[i]).collect();
    utf16_to_utf8(text, &mut sorted).expect("fixture offsets fall on char boundaries");

    let mut bytes = vec![0; offsets.len()];

    for (slot, &i) in order.iter().enumerate() {
        bytes[i] = sorted[slot];
    }

    bytes
}

/// Parses a rule setting from fixture JSON. Test-only: assumes valid input
/// (validation is the policy module's job).
pub fn setting_from_json(value: &Value) -> RuleSetting {
    let action = value["action"].as_str().expect("action");

    match action {
        "redact" => RuleSetting::Redact {
            replacement: value
                .get("replacement")
                .and_then(Value::as_str)
                .map(str::to_owned),
            priority: value.get("priority").and_then(Value::as_i64),
        },
        "format-preserve" => RuleSetting::FormatPreserve,
        "token-replace" => RuleSetting::TokenReplace {
            tokens: value.get("tokens").map(|tokens| {
                tokens
                    .as_object()
                    .expect("tokens object")
                    .iter()
                    .map(|(k, v)| (k.clone(), v.as_str().expect("token string").to_owned()))
                    .collect()
            }),
        },
        "mask" => RuleSetting::Mask {
            preserve: value.get("preserve").map(|p| MaskPreserve {
                first: p.get("first").and_then(Value::as_u64),
                last: p.get("last").and_then(Value::as_u64),
            }),
        },
        "remove" => RuleSetting::Remove,
        other => panic!("unknown action {other}"),
    }
}
