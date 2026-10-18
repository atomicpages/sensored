//! Node.js and Bun bindings for `sensored-core` (napi-rs).
//!
//! Every offset that crosses this boundary is a UTF-16 code unit, as the JS
//! `Detection` type reports. The core works in UTF-8 bytes; `offsets.rs`
//! converts once per call. Errors carry the core's code (see `error.rs`).

mod error;
mod js;
mod offsets;
mod redactor;
mod seam;
mod stream;

use indexmap::IndexMap;
use napi_derive::napi;

pub use redactor::Redactor;
pub use stream::Stream;

/// Replaces numbered placeholders found in `map` with their originals.
#[napi]
pub fn restore(text: String, map: IndexMap<String, String>) -> String {
    sensored_core::restore::restore(&text, &map)
}
