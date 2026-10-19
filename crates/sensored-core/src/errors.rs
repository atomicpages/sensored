//! Error codes and safe messages. Mirrors `packages/sensored/src/errors.ts`.
//!
//! Messages and paths never contain caller-supplied values.

use std::fmt;

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    InvalidConfig,
    UnknownRule,
    EmptyPolicy,
    InputLimit,
    DetectorContract,
    PolicyConflict,
    StreamUnsupported,
    BufferLimit,
    SourceFailure,
    Cancelled,
}

impl ErrorCode {
    /// The wire name, e.g. `INVALID_CONFIG`.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::InvalidConfig => "INVALID_CONFIG",
            Self::UnknownRule => "UNKNOWN_RULE",
            Self::EmptyPolicy => "EMPTY_POLICY",
            Self::InputLimit => "INPUT_LIMIT",
            Self::DetectorContract => "DETECTOR_CONTRACT",
            Self::PolicyConflict => "POLICY_CONFLICT",
            Self::StreamUnsupported => "STREAM_UNSUPPORTED",
            Self::BufferLimit => "BUFFER_LIMIT",
            Self::SourceFailure => "SOURCE_FAILURE",
            Self::Cancelled => "CANCELLED",
        }
    }

    pub fn message(self) -> &'static str {
        match self {
            Self::InvalidConfig => "Configuration or input has an invalid shape.",
            Self::UnknownRule => "Configuration contains an unknown rule.",
            Self::EmptyPolicy => "At least one rule must be enabled.",
            Self::DetectorContract => "A detector violated its declared contract.",
            Self::InputLimit => "Input exceeds the complete-string limit.",
            Self::PolicyConflict => {
                "Presets contain conflicting rule settings that require explicit override."
            }
            Self::StreamUnsupported => "One or more active rules do not support streaming.",
            Self::BufferLimit => "Streaming buffer exceeded the configured limit.",
            Self::SourceFailure => "The stream source produced an error.",
            Self::Cancelled => "The operation was cancelled.",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SensoredError {
    pub code: ErrorCode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// Structured metadata, e.g. available preset versions.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub info: Option<serde_json::Value>,
}

impl SensoredError {
    pub fn new(code: ErrorCode) -> Self {
        Self {
            code,
            path: None,
            info: None,
        }
    }

    pub fn at(code: ErrorCode, path: impl Into<String>) -> Self {
        Self {
            code,
            path: Some(path.into()),
            info: None,
        }
    }

    pub fn with_info(mut self, info: serde_json::Value) -> Self {
        self.info = Some(info);
        self
    }
}

impl fmt::Display for SensoredError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.code.message())
    }
}

impl std::error::Error for SensoredError {}

pub type Result<T> = std::result::Result<T, SensoredError>;
