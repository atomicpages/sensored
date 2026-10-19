//! The `Stream` class over the core's sync `StreamCore`. The core reports
//! UTF-16 offsets itself (`OffsetUnit::Utf16`), so events need no conversion.
//! `pushWith`/`finishWith` are the hybrid seam: a JS callback detects in the
//! buffer, and its UTF-16 detections are converted to bytes here.

use js_sys::Function;
use sensored_core::errors::ErrorCode;
use sensored_core::stream::{self as core, StreamCore};
use sensored_core::types::Detection as CoreDetection;
use sensored_core::{Result as CoreResult, SensoredError};
use wasm_bindgen::prelude::*;

use crate::error::{OrThrow, plain};
use crate::js::{Detection, events_to_js, from_js, to_core};

#[wasm_bindgen]
pub struct Stream {
    /// `None` once `finish` has run.
    core: Option<StreamCore>,
}

impl Stream {
    pub fn new(core: StreamCore) -> Self {
        Self { core: Some(core) }
    }

    fn active(&mut self) -> Result<&mut StreamCore, JsValue> {
        self.core.as_mut().ok_or_else(finished)
    }

    fn take(&mut self) -> Result<StreamCore, JsValue> {
        self.core.take().ok_or_else(finished)
    }
}

#[wasm_bindgen]
impl Stream {
    /// Events for the text that can be emitted so far. Throws `BUFFER_LIMIT`.
    #[wasm_bindgen(unchecked_return_type = "Array<StreamEvent>")]
    pub fn push(&mut self, chunk: &str) -> Result<JsValue, JsValue> {
        let events = self.active()?.push(chunk).or_throw()?;

        events_to_js(events)
    }

    /// `push` plus JS detections: `detect` gets the buffer whenever text may
    /// flush and returns its detections (UTF-16 offsets into the buffer).
    /// Throws what `detect` throws, or `DETECTOR_CONTRACT` for bad detections.
    #[wasm_bindgen(js_name = pushWith, unchecked_return_type = "Array<StreamEvent>")]
    pub fn push_with(
        &mut self,
        chunk: &str,
        #[wasm_bindgen(unchecked_param_type = "(buffer: string) => Array<Detection>")]
        detect: &Function,
    ) -> Result<JsValue, JsValue> {
        let mut thrown = None;
        let result = self
            .active()?
            .push_with(chunk, |buffer| call(detect, buffer, &mut thrown));

        events(result, thrown)
    }

    /// Flushes the rest; the last event is `complete`. The stream is spent
    /// afterwards: later `push` or `finish` calls throw.
    #[wasm_bindgen(unchecked_return_type = "Array<StreamEvent>")]
    pub fn finish(&mut self) -> Result<JsValue, JsValue> {
        events_to_js(self.take()?.finish())
    }

    /// `finish` plus JS detections; see `pushWith`. The stream is spent
    /// afterwards, even if `detect` throws.
    #[wasm_bindgen(js_name = finishWith, unchecked_return_type = "Array<StreamEvent>")]
    pub fn finish_with(
        &mut self,
        #[wasm_bindgen(unchecked_param_type = "(buffer: string) => Array<Detection>")]
        detect: &Function,
    ) -> Result<JsValue, JsValue> {
        let core = self.take()?;

        let mut thrown = None;
        let result = core.finish_with(|buffer| call(detect, buffer, &mut thrown));

        events(result, thrown)
    }
}

/// Runs `detect` on `buffer`. What JS throws (or a return value of the wrong
/// shape) is kept in `thrown`, since the core only carries its own errors,
/// and stands in as a contract error.
fn call(
    detect: &Function,
    buffer: &str,
    thrown: &mut Option<JsValue>,
) -> CoreResult<Vec<CoreDetection>> {
    let detections = detect
        .call1(&JsValue::UNDEFINED, &JsValue::from_str(buffer))
        .and_then(from_js::<Vec<Detection>>)
        .map_err(|error| {
            *thrown = Some(error);
            SensoredError::new(ErrorCode::DetectorContract)
        })?;

    to_core(buffer, detections).ok_or_else(|| SensoredError::new(ErrorCode::DetectorContract))
}

/// The events, or what `detect` threw before any core error.
fn events(
    result: CoreResult<Vec<core::StreamEvent>>,
    thrown: Option<JsValue>,
) -> Result<JsValue, JsValue> {
    if let Some(error) = thrown {
        return Err(error);
    }

    events_to_js(result.or_throw()?)
}

fn finished() -> JsValue {
    plain("Stream is already finished.")
}
