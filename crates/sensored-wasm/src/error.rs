//! Core errors as JS errors.
//!
//! A `SensoredError` becomes an `Error` whose `message` is the code's safe
//! message, with `code` (e.g. `INVALID_CONFIG`), plus `path` and `info` when
//! the core sets them. Same shape as `sensored-napi`; the TS loader rewraps it
//! as `SensoredError`.

use js_sys::{Error, Reflect};
use sensored_core::{ErrorCode, SensoredError};
use wasm_bindgen::JsValue;

use crate::js::to_js;

pub trait OrThrow<T> {
    /// Converts a core error into the JS error described above.
    fn or_throw(self) -> Result<T, JsValue>;
}

impl<T> OrThrow<T> for sensored_core::Result<T> {
    fn or_throw(self) -> Result<T, JsValue> {
        self.map_err(|error| js_error(&error))
    }
}

pub fn throw<T>(code: ErrorCode) -> Result<T, JsValue> {
    Err(js_error(&SensoredError::new(code)))
}

/// A plain `Error` with no core fields, e.g. for a spent stream.
pub fn plain(message: &str) -> JsValue {
    Error::new(message).into()
}

fn js_error(error: &SensoredError) -> JsValue {
    let object: JsValue = Error::new(error.code.message()).into();

    set(&object, "code", &JsValue::from_str(error.code.as_str()));

    if let Some(path) = &error.path {
        set(&object, "path", &JsValue::from_str(path));
    }

    if let Some(info) = error.info.as_ref().and_then(|info| to_js(info).ok()) {
        set(&object, "info", &info);
    }

    object
}

/// `Reflect.set` on a fresh, extensible `Error` cannot fail.
fn set(target: &JsValue, key: &str, value: &JsValue) {
    let _ = Reflect::set(target, &JsValue::from_str(key), value);
}
