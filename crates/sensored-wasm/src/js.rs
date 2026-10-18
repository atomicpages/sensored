//! JS-facing values, shaped like `sensored-napi/index.d.ts`.
//!
//! Outgoing values are core types serialized to plain JS objects and arrays
//! (maps as objects, key order kept), after their offsets are moved to UTF-16
//! units in place. Incoming detections deserialize into `Detection`.

use sensored_core::stream as core_stream;
use sensored_core::types::{self as core, RestorationMap};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Deserializer, Serialize};
use serde_wasm_bindgen::Serializer;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::wasm_bindgen;

use crate::offsets::OffsetMap;

#[wasm_bindgen(typescript_custom_section)]
const TYPES: &str = r#"
export interface Detection {
  start: number;
  end: number;
  ruleId: string;
  entityType: string;
  reasons: Array<string>;
}

export interface InspectedMatch extends Detection {
  value: string;
}

export interface InspectionGroup {
  start: number;
  end: number;
  replacement: string;
  matches: Array<InspectedMatch>;
}

export interface Inspection {
  text: string;
  groups: Array<InspectionGroup>;
  map?: Record<string, string>;
}

export interface RedactResult {
  text: string;
  map?: Record<string, string>;
}

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "detection"; group: InspectionGroup }
  | { type: "complete"; map?: Record<string, string> };
"#;

/// Maps become plain objects (not `Map`), as napi returns them.
const SERIALIZER: Serializer = Serializer::new().serialize_maps_as_objects(true);

pub fn to_js<T: Serialize + ?Sized>(value: &T) -> Result<JsValue, JsValue> {
    value.serialize(&SERIALIZER).map_err(JsValue::from)
}

/// A value of the wrong shape throws a plain `Error`, as napi's argument
/// conversion does.
pub fn from_js<T: DeserializeOwned>(value: JsValue) -> Result<T, JsValue> {
    serde_wasm_bindgen::from_value(value).map_err(JsValue::from)
}

/// A detection from JS: UTF-16 offsets.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Detection {
    #[serde(deserialize_with = "uint32")]
    pub start: u32,
    #[serde(deserialize_with = "uint32")]
    pub end: u32,
    pub rule_id: String,
    pub entity_type: String,
    pub reasons: Vec<String>,
}

/// A JS number as napi reads a `u32` (ECMAScript `ToUint32`): truncated and
/// wrapped, so `-1` becomes an out-of-bounds offset (`DETECTOR_CONTRACT`)
/// rather than a conversion error.
fn uint32<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u32, D::Error> {
    let number = f64::deserialize(deserializer)?;

    if !number.is_finite() {
        return Ok(0);
    }

    // In [0, 2^32) after `rem_euclid`, so the cast is exact.
    Ok(number.trunc().rem_euclid(4_294_967_296.0) as u32)
}

/// `map` is set when restoration is enabled.
#[derive(Serialize)]
pub struct RedactResult {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub map: Option<RestorationMap>,
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum StreamEvent {
    Text {
        text: String,
    },
    Detection {
        group: core::InspectionGroup,
    },
    Complete {
        #[serde(skip_serializing_if = "Option::is_none")]
        map: Option<RestorationMap>,
    },
}

impl From<core_stream::StreamEvent> for StreamEvent {
    /// Stream offsets are UTF-16 already (`OffsetUnit::Utf16`).
    fn from(event: core_stream::StreamEvent) -> Self {
        match event {
            core_stream::StreamEvent::Text(text) => Self::Text { text },
            core_stream::StreamEvent::Detection(group) => Self::Detection { group },
            core_stream::StreamEvent::Complete(map) => Self::Complete { map },
        }
    }
}

pub fn events_to_js(events: Vec<core_stream::StreamEvent>) -> Result<JsValue, JsValue> {
    let events: Vec<StreamEvent> = events.into_iter().map(StreamEvent::from).collect();

    to_js(&events)
}

/// Core detections (byte offsets into `text`) as JS ones.
pub fn detections_to_js(
    text: &str,
    mut detections: Vec<core::Detection>,
) -> Result<JsValue, JsValue> {
    let offsets = OffsetMap::utf8_to_utf16(text, detections.iter().flat_map(|d| [d.start, d.end]));

    for detection in &mut detections {
        detection.start = offsets.get(detection.start);
        detection.end = offsets.get(detection.end);
    }

    to_js(&detections)
}

/// A core inspection of `source` as a JS one.
pub fn inspection_to_js(
    source: &str,
    mut inspection: core::Inspection,
) -> Result<JsValue, JsValue> {
    let bounds = inspection.groups.iter().flat_map(|group| {
        let matches = group
            .matches
            .iter()
            .flat_map(|m| [m.detection.start, m.detection.end]);

        [group.start, group.end].into_iter().chain(matches)
    });
    let offsets = OffsetMap::utf8_to_utf16(source, bounds);

    for group in &mut inspection.groups {
        group.start = offsets.get(group.start);
        group.end = offsets.get(group.end);

        for inspected in &mut group.matches {
            inspected.detection.start = offsets.get(inspected.detection.start);
            inspected.detection.end = offsets.get(inspected.detection.end);
        }
    }

    to_js(&inspection)
}

/// JS detections with byte offsets; `None` if an offset is out of bounds or
/// inside a surrogate pair.
pub fn to_core(text: &str, detections: Vec<Detection>) -> Option<Vec<core::Detection>> {
    let bounds = detections
        .iter()
        .flat_map(|d| [d.start as usize, d.end as usize]);
    let offsets = OffsetMap::utf16_to_utf8(text, bounds)?;

    Some(
        detections
            .into_iter()
            .map(|d| core::Detection {
                start: offsets.get(d.start as usize),
                end: offsets.get(d.end as usize),
                rule_id: d.rule_id,
                entity_type: d.entity_type,
                reasons: d.reasons,
            })
            .collect(),
    )
}
