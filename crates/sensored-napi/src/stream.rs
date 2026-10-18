//! The `Stream` class over the core's sync `StreamCore`. The core reports
//! UTF-16 offsets itself (`OffsetUnit::Utf16`), so events need no conversion.
//! `pushWith`/`finishWith` are the hybrid seam: a JS callback detects in the
//! buffer, and its UTF-16 detections are converted to bytes here.

use napi::Env;
use napi::bindgen_prelude::Function;
use napi_derive::napi;
use sensored_core::errors::ErrorCode;
use sensored_core::stream::{self as core, StreamCore};
use sensored_core::types::Detection as CoreDetection;
use sensored_core::{Result as CoreResult, SensoredError};

use crate::error::OrThrow;
use crate::js::{Detection, InspectionGroup, StreamEvent, js_offset};
use crate::redactor::to_core;

/// `(buffer: string) => Detection[]`, called synchronously.
type Detect<'a> = Function<'a, String, Vec<Detection>>;

#[napi]
pub struct Stream {
    /// `None` once `finish` has run.
    core: Option<StreamCore>,
}

impl Stream {
    pub fn new(core: StreamCore) -> Self {
        Self { core: Some(core) }
    }

    fn active(&mut self) -> napi::Result<&mut StreamCore> {
        self.core.as_mut().ok_or_else(finished)
    }
}

#[napi]
impl Stream {
    /// Events for the text that can be emitted so far. Throws `BUFFER_LIMIT`.
    #[napi]
    pub fn push(&mut self, env: &Env, chunk: String) -> napi::Result<Vec<StreamEvent>> {
        let events = self.active()?.push(&chunk).or_throw(env)?;

        Ok(events.into_iter().map(to_js).collect())
    }

    /// `push` plus JS detections: `detect` gets the buffer whenever text may
    /// flush and returns its detections (UTF-16 offsets into the buffer).
    /// Throws what `detect` throws, or `DETECTOR_CONTRACT` for bad detections.
    #[napi(ts_args_type = "chunk: string, detect: (buffer: string) => Array<Detection>")]
    pub fn push_with(
        &mut self,
        env: &Env,
        chunk: String,
        detect: Detect<'_>,
    ) -> napi::Result<Vec<StreamEvent>> {
        let mut thrown = None;
        let result = self
            .active()?
            .push_with(&chunk, |buffer| call(&detect, buffer, &mut thrown));

        events(env, result, thrown)
    }

    /// Flushes the rest; the last event is `complete`. The stream is spent
    /// afterwards: later `push` or `finish` calls throw.
    #[napi]
    pub fn finish(&mut self) -> napi::Result<Vec<StreamEvent>> {
        let core = self.core.take().ok_or_else(finished)?;

        Ok(core.finish().into_iter().map(to_js).collect())
    }

    /// `finish` plus JS detections; see `pushWith`. The stream is spent
    /// afterwards, even if `detect` throws.
    #[napi(ts_args_type = "detect: (buffer: string) => Array<Detection>")]
    pub fn finish_with(&mut self, env: &Env, detect: Detect<'_>) -> napi::Result<Vec<StreamEvent>> {
        let core = self.core.take().ok_or_else(finished)?;

        let mut thrown = None;
        let result = core.finish_with(|buffer| call(&detect, buffer, &mut thrown));

        events(env, result, thrown)
    }
}

/// Runs `detect` on `buffer`. A JS exception is kept in `thrown` (the core
/// only carries its own errors) and stands in as a contract error.
fn call(
    detect: &Detect<'_>,
    buffer: &str,
    thrown: &mut Option<napi::Error>,
) -> CoreResult<Vec<CoreDetection>> {
    let detections = detect.call(buffer.to_owned()).map_err(|error| {
        *thrown = Some(error);
        SensoredError::new(ErrorCode::DetectorContract)
    })?;

    to_core(buffer, detections).ok_or_else(|| SensoredError::new(ErrorCode::DetectorContract))
}

/// The events, or the JS exception from `detect` before any core error.
fn events(
    env: &Env,
    result: CoreResult<Vec<core::StreamEvent>>,
    thrown: Option<napi::Error>,
) -> napi::Result<Vec<StreamEvent>> {
    if let Some(error) = thrown {
        return Err(error);
    }

    Ok(result.or_throw(env)?.into_iter().map(to_js).collect())
}

fn finished() -> napi::Error {
    napi::Error::from_reason("Stream is already finished.")
}

fn to_js(event: core::StreamEvent) -> StreamEvent {
    match event {
        core::StreamEvent::Text(text) => StreamEvent::Text { text },
        core::StreamEvent::Detection(group) => StreamEvent::Detection {
            group: InspectionGroup::from_core(group, js_offset),
        },
        core::StreamEvent::Complete(map) => StreamEvent::Complete { map },
    }
}
