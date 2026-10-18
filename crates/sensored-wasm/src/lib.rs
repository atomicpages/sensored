//! WebAssembly bindings for `sensored-core` (wasm-bindgen).
//!
//! The API mirrors `sensored-napi` and satisfies the same `NativeBinding`
//! contract (`packages/sensored/src/native/binding.ts`). Every offset that
//! crosses this boundary is a UTF-16 code unit; `offsets.rs` converts once per
//! call. Errors carry the core's code (see `error.rs`). Returned values are
//! plain JS objects and arrays (see `js.rs`).

mod error;
mod js;
mod offsets;
mod redactor;
mod stream;

use sensored_core::types::RestorationMap;
use wasm_bindgen::prelude::*;

use crate::error::plain;

pub use redactor::Redactor;
pub use stream::Stream;

/// Replaces numbered placeholders found in `map` with their originals.
#[wasm_bindgen]
pub fn restore(
    text: &str,
    #[wasm_bindgen(unchecked_param_type = "Record<string, string>")] map: JsValue,
) -> Result<String, JsValue> {
    let map: RestorationMap = js::from_js(map)?;

    Ok(sensored_core::restore::restore(text, &map))
}

/// Every built-in `DetectorDescription`, in `listDetectors()` order, as JSON.
#[wasm_bindgen(js_name = listDetectorsJson)]
pub fn list_detectors_json() -> Result<String, JsValue> {
    serde_json::to_string(&sensored_core::list_detectors())
        .map_err(|error| plain(&error.to_string()))
}
