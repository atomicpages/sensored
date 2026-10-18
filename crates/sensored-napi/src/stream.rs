//! The `Stream` class over the core's sync `StreamCore`. The core reports
//! UTF-16 offsets itself (`OffsetUnit::Utf16`), so events need no conversion.

use napi::Env;
use napi_derive::napi;
use sensored_core::stream::{self as core, StreamCore};

use crate::error::OrThrow;
use crate::js::{InspectionGroup, StreamEvent, js_offset};

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

    /// Flushes the rest; the last event is `complete`. The stream is spent
    /// afterwards: later `push` or `finish` calls throw.
    #[napi]
    pub fn finish(&mut self) -> napi::Result<Vec<StreamEvent>> {
        let core = self.core.take().ok_or_else(finished)?;

        Ok(core.finish().into_iter().map(to_js).collect())
    }
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
