//! Streaming-first PII redaction engine. The Rust core of `sensored`.
//!
//! Offsets are UTF-8 byte offsets; windows, limits and stream bounds are
//! UTF-16 code units, matching the TS reference (see [`text`]).

pub mod checksum;
pub mod detector;
pub mod detectors;
pub mod errors;
pub mod grapheme;
pub mod hash;
pub mod policy;
pub mod render;
pub mod restore;
pub mod stream_restore;
pub mod text;
pub mod token_generators;
pub mod types;

pub use errors::{ErrorCode, Result, SensoredError};
