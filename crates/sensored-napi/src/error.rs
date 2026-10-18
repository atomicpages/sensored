//! Core errors as JS errors.
//!
//! A `SensoredError` becomes an `Error` whose `message` is the code's safe
//! message, with `code` (e.g. `INVALID_CONFIG`), plus `path` and `info` when
//! the core sets them. The TS loader rewraps it as `SensoredError`.

use napi::{Env, JsValue};
use sensored_core::{ErrorCode, SensoredError};

pub trait OrThrow<T> {
    /// Converts a core error into the JS error described above.
    fn or_throw(self, env: &Env) -> napi::Result<T>;
}

impl<T> OrThrow<T> for sensored_core::Result<T> {
    fn or_throw(self, env: &Env) -> napi::Result<T> {
        self.map_err(|error| js_error(env, &error))
    }
}

pub fn throw<T>(env: &Env, code: ErrorCode) -> napi::Result<T> {
    Err(js_error(env, &SensoredError::new(code)))
}

fn js_error(env: &Env, error: &SensoredError) -> napi::Error {
    build(env, error).unwrap_or_else(|failure| failure)
}

fn build(env: &Env, error: &SensoredError) -> napi::Result<napi::Error> {
    let mut object = env.create_error(napi::Error::from_reason(error.code.message()))?;

    object.set("code", error.code.as_str())?;

    if let Some(path) = &error.path {
        object.set("path", path.as_str())?;
    }

    if let Some(info) = &error.info {
        object.set("info", info)?;
    }

    // An `Error` built from a JS value throws that value as is.
    Ok(napi::Error::from(object.to_unknown()))
}
