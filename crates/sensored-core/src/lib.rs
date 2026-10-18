//! Streaming-first PII redaction engine. The Rust core of `sensored`.
//!
//! Offsets are UTF-8 byte offsets; windows, limits and stream bounds are
//! UTF-16 code units, matching the TS reference (see [`text`]).

pub mod checksum;
pub mod detector;
pub mod detectors;
pub mod engine;
pub mod errors;
pub mod grapheme;
pub mod hash;
pub mod policy;
pub mod redactor;
pub mod render;
pub mod restore;
pub mod stream;
pub mod stream_restore;
pub mod text;
pub mod types;

pub use errors::{ErrorCode, Result, SensoredError};
pub use redactor::{Redacted, Redactor, StreamSettings};
