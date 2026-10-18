//! The `Redactor` class. Fast path: `redact`, `redactWithMap`, `inspect` and
//! `stream` go straight to the core `Redactor`, one call each. The hybrid seam
//! (`collect`, `filter`, `render`) goes to the core's seam methods.

use sensored_core::StreamSettings;
use sensored_core::errors::ErrorCode;
use sensored_core::stream::OffsetUnit;
use wasm_bindgen::prelude::*;

use crate::error::{OrThrow, plain, throw};
use crate::js::{self, Detection, RedactResult, from_js, to_core};
use crate::stream::Stream;

#[wasm_bindgen]
pub struct Redactor {
    core: sensored_core::Redactor,
}

#[wasm_bindgen]
impl Redactor {
    /// Builds a redactor from a JSON `RedactorConfig` (functions and RegExps
    /// stripped by the TS wrapper; JS detectors as descriptors).
    pub fn create(
        #[wasm_bindgen(js_name = configJson)] config_json: &str,
    ) -> Result<Redactor, JsValue> {
        let Ok(config) = serde_json::from_str(config_json) else {
            return throw(ErrorCode::InvalidConfig);
        };

        let core = sensored_core::Redactor::new(&config).or_throw()?;

        Ok(Self { core })
    }

    pub fn redact(&self, text: &str) -> Result<String, JsValue> {
        Ok(self.core.redact(text).or_throw()?.text)
    }

    #[wasm_bindgen(js_name = redactWithMap, unchecked_return_type = "RedactResult")]
    pub fn redact_with_map(&self, text: &str) -> Result<JsValue, JsValue> {
        let redacted = self.core.redact(text).or_throw()?;

        js::to_js(&RedactResult {
            text: redacted.text,
            map: redacted.map,
        })
    }

    #[wasm_bindgen(unchecked_return_type = "Inspection")]
    pub fn inspect(&self, text: &str) -> Result<JsValue, JsValue> {
        let inspection = self.core.inspect(text).or_throw()?;

        js::inspection_to_js(text, inspection)
    }

    /// The effective policy (rule id to setting) as JSON.
    #[wasm_bindgen(js_name = policyJson)]
    pub fn policy_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(self.core.policy()).map_err(|error| plain(&error.to_string()))
    }

    /// `restore` overrides the config's setting for this stream.
    pub fn stream(&self, report: bool, restore: Option<bool>) -> Result<Stream, JsValue> {
        let settings = StreamSettings {
            report,
            restore,
            offsets: OffsetUnit::Utf16,
        };

        Ok(Stream::new(self.core.stream(settings).or_throw()?))
    }

    /// Raw core detections, before allowlist and placeholder filtering.
    #[wasm_bindgen(unchecked_return_type = "Array<Detection>")]
    pub fn collect(&self, text: &str) -> Result<JsValue, JsValue> {
        let detections = self.core.collect(text).or_throw()?;

        js::detections_to_js(text, detections)
    }

    /// `detections` (core plus JS) without those `render` drops: matches
    /// inside existing placeholders and allowlisted values.
    #[wasm_bindgen(unchecked_return_type = "Array<Detection>")]
    pub fn filter(
        &self,
        text: &str,
        #[wasm_bindgen(unchecked_param_type = "Array<Detection>")] detections: JsValue,
    ) -> Result<JsValue, JsValue> {
        let detections = core_detections(text, detections)?;
        let kept = self.core.filter(text, detections).or_throw()?;

        js::detections_to_js(text, kept)
    }

    /// Filters, groups and renders `detections` (core plus JS). Groups are
    /// reported only when `report` is set.
    #[wasm_bindgen(unchecked_return_type = "Inspection")]
    pub fn render(
        &self,
        text: &str,
        #[wasm_bindgen(unchecked_param_type = "Array<Detection>")] detections: JsValue,
        report: bool,
    ) -> Result<JsValue, JsValue> {
        let detections = core_detections(text, detections)?;
        let inspection = self.core.render(text, detections, report).or_throw()?;

        js::inspection_to_js(text, inspection)
    }

    /// The enabled rules' `DetectorDescription`s, in policy order, as JSON.
    #[wasm_bindgen(js_name = describeJson)]
    pub fn describe_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.core.describe()).map_err(|error| plain(&error.to_string()))
    }
}

/// JS detections with byte offsets. Throws `DETECTOR_CONTRACT` if an offset
/// is out of bounds or inside a surrogate pair.
fn core_detections(
    text: &str,
    detections: JsValue,
) -> Result<Vec<sensored_core::types::Detection>, JsValue> {
    let detections: Vec<Detection> = from_js(detections)?;

    match to_core(text, detections) {
        Some(detections) => Ok(detections),
        None => throw(ErrorCode::DetectorContract),
    }
}
