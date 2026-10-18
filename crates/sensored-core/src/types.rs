//! Shared data types. Mirrors `packages/sensored/src/types.ts`.
//!
//! Offsets are UTF-8 byte offsets into the text being processed. Bindings that
//! expose UTF-16 offsets (napi, Wasm) convert at their boundary.

use std::sync::Arc;

use indexmap::IndexMap;
use serde::Serialize;

use crate::detector::Detector;

/// One detector hit on the original text.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Detection {
    pub start: usize,
    pub end: usize,
    pub rule_id: String,
    pub entity_type: String,
    pub reasons: Vec<String>,
}

/// A detection plus the original text it covers (reports only).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectedMatch {
    #[serde(flatten)]
    pub detection: Detection,
    pub value: String,
}

/// A transitive overlap group and its rendered replacement.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct InspectionGroup {
    pub start: usize,
    pub end: usize,
    pub replacement: String,
    pub matches: Vec<InspectedMatch>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Inspection {
    pub text: String,
    pub groups: Vec<InspectionGroup>,
    /// Present when restoration is enabled.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub map: Option<RestorationMap>,
}

/// Placeholder to original value, in insertion order.
pub type RestorationMap = IndexMap<String, String>;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct MaskPreserve {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last: Option<u64>,
}

/// A validated rule setting. Serializes to the same JSON as the TS policy.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "action", rename_all = "kebab-case")]
pub enum RuleSetting {
    Redact {
        #[serde(skip_serializing_if = "Option::is_none")]
        replacement: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        priority: Option<i64>,
    },
    FormatPreserve,
    TokenReplace {
        #[serde(skip_serializing_if = "Option::is_none")]
        tokens: Option<IndexMap<String, String>>,
    },
    Mask {
        #[serde(skip_serializing_if = "Option::is_none")]
        preserve: Option<MaskPreserve>,
    },
    Remove,
}

/// An enabled rule: the detector plus how its matches are transformed.
#[derive(Clone)]
pub struct ActiveRule {
    pub detector: Arc<dyn Detector>,
    pub setting: RuleSetting,
}

impl std::fmt::Debug for ActiveRule {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ActiveRule")
            .field("detector", &self.detector.id())
            .field("setting", &self.setting)
            .finish()
    }
}

/// A detection paired with the rule that produced it. Mirrors `AppliedMatch`.
#[derive(Debug, Clone)]
pub struct AppliedMatch<'a> {
    pub detection: Detection,
    pub rule: &'a ActiveRule,
}

/// Numbered-placeholder state for `restore: true`. Mirrors `RestorationContext`.
#[derive(Debug, Clone, Default)]
pub struct RestorationContext {
    /// Placeholder (`[EMAIL_1]`) to original value.
    pub map: RestorationMap,
    /// Entity type (upper-cased placeholder stem) to last number issued.
    pub counters: IndexMap<String, u64>,
    /// Original value to placeholder; `Some` only for sessions (dedup).
    pub reverse_map: Option<IndexMap<String, String>>,
}

impl RestorationContext {
    pub fn new(dedup: bool) -> Self {
        Self {
            map: RestorationMap::new(),
            counters: IndexMap::new(),
            reverse_map: dedup.then(IndexMap::new),
        }
    }
}
