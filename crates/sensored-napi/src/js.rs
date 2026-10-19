//! JS-facing objects, shaped like `packages/sensored/src/types.ts`.
//!
//! Offsets are UTF-16 code units. Conversions from core types move strings
//! instead of copying them; `offset` maps a core offset to the JS one.

use indexmap::IndexMap;
use napi_derive::napi;
use sensored_core::types as core;

#[napi(object)]
pub struct Detection {
    pub start: u32,
    pub end: u32,
    pub rule_id: String,
    pub entity_type: String,
    pub reasons: Vec<String>,
}

#[napi(object)]
pub struct InspectedMatch {
    pub start: u32,
    pub end: u32,
    pub rule_id: String,
    pub entity_type: String,
    pub reasons: Vec<String>,
    pub value: String,
}

#[napi(object)]
pub struct InspectionGroup {
    pub start: u32,
    pub end: u32,
    pub replacement: String,
    pub matches: Vec<InspectedMatch>,
}

/// `map` is set when restoration is enabled.
#[napi(object)]
pub struct RedactResult {
    pub text: String,
    pub map: Option<IndexMap<String, String>>,
}

#[napi(discriminant_case = "lowercase")]
pub enum StreamEvent {
    Text {
        text: String,
    },
    Detection {
        group: InspectionGroup,
    },
    Complete {
        map: Option<IndexMap<String, String>>,
    },
}

/// JS strings are at most 2^32 - 1 code units long, so UTF-16 offsets fit.
pub fn js_offset(units: usize) -> u32 {
    u32::try_from(units).expect("UTF-16 offsets fit in u32")
}

impl Detection {
    pub fn from_core(detection: core::Detection, offset: impl Fn(usize) -> u32) -> Self {
        Self {
            start: offset(detection.start),
            end: offset(detection.end),
            rule_id: detection.rule_id.into_owned(),
            entity_type: detection.entity_type.into_owned(),
            reasons: owned(detection.reasons),
        }
    }
}

impl InspectionGroup {
    pub fn from_core(group: core::InspectionGroup, offset: impl Fn(usize) -> u32) -> Self {
        let matches = group
            .matches
            .into_iter()
            .map(|inspected| InspectedMatch {
                start: offset(inspected.detection.start),
                end: offset(inspected.detection.end),
                rule_id: inspected.detection.rule_id.into_owned(),
                entity_type: inspected.detection.entity_type.into_owned(),
                reasons: owned(inspected.detection.reasons),
                value: inspected.value,
            })
            .collect();

        Self {
            start: offset(group.start),
            end: offset(group.end),
            replacement: group.replacement,
            matches,
        }
    }
}

fn owned(labels: Vec<core::Label>) -> Vec<String> {
    labels.into_iter().map(core::Label::into_owned).collect()
}
