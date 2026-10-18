//! The public entry point. Mirrors `createRedactor` in `index.ts`.

use indexmap::IndexMap;

use crate::detectors::{Registry, builtins};
use crate::engine::{RenderOptions, process_text};
use crate::errors::{ErrorCode, Result, SensoredError};
use crate::policy::{ResolvedPolicy, resolve_policy};
use crate::stream::{OffsetUnit, StreamCore, StreamOptions};
use crate::text::utf16_len;
use crate::types::{Inspection, RestorationMap, RuleSetting};

/// Output of `redact`; `map` is set when the config enables `restore`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Redacted {
    pub text: String,
    pub map: Option<RestorationMap>,
}

/// Per-stream overrides. `restore: None` keeps the config's setting.
#[derive(Debug, Clone, Copy, Default)]
pub struct StreamSettings {
    pub report: bool,
    pub restore: Option<bool>,
    pub offsets: OffsetUnit,
}

/// An immutable redactor built from a JSON config.
#[derive(Debug, Clone)]
pub struct Redactor {
    resolved: ResolvedPolicy,
}

impl Redactor {
    /// Builds a redactor over the built-in detectors.
    pub fn new(config: &serde_json::Value) -> Result<Self> {
        Self::with_registry(config, &builtins())
    }

    pub fn with_registry(config: &serde_json::Value, registry: &Registry) -> Result<Self> {
        Ok(Self {
            resolved: resolve_policy(config, registry)?,
        })
    }

    /// Rule id to effective setting.
    pub fn policy(&self) -> &IndexMap<String, RuleSetting> {
        &self.resolved.policy
    }

    pub fn redact(&self, text: &str) -> Result<Redacted> {
        let inspection = self.process(text, false)?;

        Ok(Redacted {
            text: inspection.text,
            map: inspection.map,
        })
    }

    pub fn inspect(&self, text: &str) -> Result<Inspection> {
        self.process(text, true)
    }

    pub fn stream(&self, settings: StreamSettings) -> Result<StreamCore> {
        let options = StreamOptions {
            report: settings.report,
            restore: settings.restore.unwrap_or(self.resolved.restore),
            detect_only: self.resolved.detect_only,
            allowlist: self.resolved.allowlist.clone(),
            offsets: settings.offsets,
        };

        StreamCore::new(self.resolved.rules.clone(), options)
    }

    fn process(&self, text: &str, report: bool) -> Result<Inspection> {
        // UTF-16 length never exceeds byte length, so short input skips the count.
        let limit = self.resolved.max_input_length;

        if text.len() > limit && utf16_len(text) > limit {
            return Err(SensoredError::new(ErrorCode::InputLimit));
        }

        let options = RenderOptions {
            report,
            detect_only: self.resolved.detect_only,
            allowlist: &self.resolved.allowlist,
        };

        Ok(process_text(
            text,
            &self.resolved.rules,
            self.resolved.restore,
            options,
        ))
    }
}
