//! The `Redactor` class. Fast path: `redact`, `redactWithMap`, `inspect` and
//! `stream` go straight to the core `Redactor`, one FFI call each. The hybrid
//! seam (`collect`, `filter`, `render`) goes to the core's seam methods.

use napi::Env;
use napi_derive::napi;
use sensored_core::StreamSettings;
use sensored_core::errors::ErrorCode;
use sensored_core::stream::OffsetUnit;
use sensored_core::types as core;

use crate::error::{OrThrow, throw};
use crate::js::{Detection, Inspection, RedactResult, js_offset};
use crate::offsets::OffsetMap;
use crate::stream::Stream;

#[napi]
pub struct Redactor {
    core: sensored_core::Redactor,
}

#[napi]
impl Redactor {
    /// Builds a redactor from a JSON `RedactorConfig` (functions and RegExps
    /// stripped by the TS wrapper; JS detectors as descriptors).
    #[napi(factory)]
    pub fn create(env: &Env, config_json: String) -> napi::Result<Self> {
        let Ok(config) = serde_json::from_str(&config_json) else {
            return throw(env, ErrorCode::InvalidConfig);
        };

        let core = sensored_core::Redactor::new(&config).or_throw(env)?;

        Ok(Self { core })
    }

    #[napi]
    pub fn redact(&self, env: &Env, text: String) -> napi::Result<String> {
        Ok(self.core.redact(&text).or_throw(env)?.text)
    }

    #[napi]
    pub fn redact_with_map(&self, env: &Env, text: String) -> napi::Result<RedactResult> {
        let redacted = self.core.redact(&text).or_throw(env)?;

        Ok(RedactResult {
            text: redacted.text,
            map: redacted.map,
        })
    }

    #[napi]
    pub fn inspect(&self, env: &Env, text: String) -> napi::Result<Inspection> {
        let inspection = self.core.inspect(&text).or_throw(env)?;

        Ok(Inspection::from_core(&text, inspection))
    }

    /// The effective policy (rule id to setting) as JSON.
    #[napi]
    pub fn policy_json(&self) -> napi::Result<String> {
        serde_json::to_string(self.core.policy()).map_err(napi::Error::from)
    }

    /// `restore` overrides the config's setting for this stream.
    #[napi]
    pub fn stream(&self, env: &Env, report: bool, restore: Option<bool>) -> napi::Result<Stream> {
        let settings = StreamSettings {
            report,
            restore,
            offsets: OffsetUnit::Utf16,
        };

        Ok(Stream::new(self.core.stream(settings).or_throw(env)?))
    }

    /// Raw core detections, before allowlist and placeholder filtering.
    #[napi]
    pub fn collect(&self, env: &Env, text: String) -> napi::Result<Vec<Detection>> {
        let detections = self.core.collect(&text).or_throw(env)?;

        Ok(to_js(&text, detections))
    }

    /// `detections` (core plus JS) without those `render` drops: matches
    /// inside existing placeholders and allowlisted values.
    #[napi]
    pub fn filter(
        &self,
        env: &Env,
        text: String,
        detections: Vec<Detection>,
    ) -> napi::Result<Vec<Detection>> {
        let Some(detections) = to_core(&text, detections) else {
            return throw(env, ErrorCode::DetectorContract);
        };

        let kept = self.core.filter(&text, detections).or_throw(env)?;

        Ok(to_js(&text, kept))
    }

    /// Filters, groups and renders `detections` (core plus JS). Groups are
    /// reported only when `report` is set.
    #[napi]
    pub fn render(
        &self,
        env: &Env,
        text: String,
        detections: Vec<Detection>,
        report: bool,
    ) -> napi::Result<Inspection> {
        let Some(detections) = to_core(&text, detections) else {
            return throw(env, ErrorCode::DetectorContract);
        };

        let inspection = self.core.render(&text, detections, report).or_throw(env)?;

        Ok(Inspection::from_core(&text, inspection))
    }

    /// The enabled rules' `DetectorDescription`s, in policy order, as JSON.
    #[napi]
    pub fn describe_json(&self) -> napi::Result<String> {
        serde_json::to_string(&self.core.describe()).map_err(napi::Error::from)
    }
}

/// Core detections with UTF-16 offsets.
fn to_js(text: &str, detections: Vec<core::Detection>) -> Vec<Detection> {
    let bounds = detections.iter().flat_map(|d| [d.start, d.end]);
    let offsets = OffsetMap::utf8_to_utf16(text, bounds);

    detections
        .into_iter()
        .map(|d| Detection::from_core(d, |bytes| js_offset(offsets.get(bytes))))
        .collect()
}

/// JS detections with byte offsets; `None` if an offset is out of bounds or
/// inside a surrogate pair.
fn to_core(text: &str, detections: Vec<Detection>) -> Option<Vec<core::Detection>> {
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
