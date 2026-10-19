//! The public entry point. Mirrors `createRedactor` in `index.ts`.
//!
//! `collect` and `render` are the hybrid seam for bindings with caller-side
//! detectors (JS `DetectorDefinition`s): collect the core's detections, add
//! the caller's, render them together.

use std::collections::HashMap;

use indexmap::IndexMap;

use crate::detector::DetectorDescription;
use crate::detectors::{Registry, builtins};
use crate::engine::{
    RenderOptions, detect_matches, filter_detected, is_valid_span, process_text, render_detected,
};
use crate::errors::{ErrorCode, Result, SensoredError};
use crate::policy::{ResolvedPolicy, resolve_policy};
use crate::stream::{OffsetUnit, StreamCore, StreamOptions};
use crate::text::utf16_len;
use crate::types::{
    ActiveRule, AppliedMatch, Detection, Inspection, RestorationContext, RestorationMap,
    RuleSetting,
};

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
    /// Rule id to its index in `resolved.rules`, for caller detections.
    rule_index: HashMap<String, usize>,
}

impl Redactor {
    /// Builds a redactor over the built-in detectors.
    pub fn new(config: &serde_json::Value) -> Result<Self> {
        Self::with_registry(config, &builtins())
    }

    pub fn with_registry(config: &serde_json::Value, registry: &Registry) -> Result<Self> {
        let resolved = resolve_policy(config, registry)?;

        let rule_index = resolved
            .rules
            .iter()
            .enumerate()
            .map(|(index, rule)| (rule.detector.id().to_owned(), index))
            .collect();

        Ok(Self {
            resolved,
            rule_index,
        })
    }

    /// The enabled rules' detectors, in policy order.
    pub fn describe(&self) -> Vec<DetectorDescription> {
        self.resolved
            .rules
            .iter()
            .map(|rule| DetectorDescription::of(rule.detector.as_ref()))
            .collect()
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

    /// Every enabled rule's raw detections, unfiltered: `render` drops
    /// allowlisted values and matches inside existing placeholders.
    pub fn collect(&self, text: &str) -> Result<Vec<Detection>> {
        self.check_input(text)?;

        Ok(detect_matches(text, &self.resolved.rules)
            .into_iter()
            .map(|applied| applied.detection)
            .collect())
    }

    /// `detections` without those `render` drops: matches inside existing
    /// placeholders and allowlisted values. For callers that act on matches
    /// before rendering, such as semantic confirmation. Same contract checks
    /// as `render`.
    pub fn filter(&self, text: &str, detections: Vec<Detection>) -> Result<Vec<Detection>> {
        self.check_input(text)?;

        let detected = detections
            .into_iter()
            .map(|detection| self.apply(text, detection))
            .collect::<Result<Vec<_>>>()?;

        Ok(filter_detected(text, detected, &self.resolved.allowlist)
            .into_iter()
            .map(|applied| applied.detection)
            .collect())
    }

    /// Renders `detections`, which may mix `collect`'s output with the
    /// caller's. A rule id outside the enabled rules, an empty span or a span
    /// off char boundaries is a `DETECTOR_CONTRACT` error.
    pub fn render(
        &self,
        text: &str,
        detections: Vec<Detection>,
        report: bool,
    ) -> Result<Inspection> {
        self.check_input(text)?;

        let detected = detections
            .into_iter()
            .map(|detection| self.apply(text, detection))
            .collect::<Result<Vec<_>>>()?;

        let mut restoration = (self.resolved.restore && !self.resolved.detect_only)
            .then(|| RestorationContext::new(false));

        let rendered = render_detected(
            text,
            detected,
            text.len(),
            0,
            restoration.as_mut(),
            self.options(report),
        );

        Ok(Inspection {
            text: rendered.segments.iter().map(|s| s.text.as_ref()).collect(),
            groups: rendered.groups,
            map: restoration.map(|context| context.map),
        })
    }

    fn apply(&self, text: &str, detection: Detection) -> Result<AppliedMatch<'_>> {
        let in_bounds = is_valid_span(text, &detection);

        let rule = self.rule(&detection.rule_id);

        match (in_bounds, rule) {
            (true, Some(rule)) => Ok(AppliedMatch { detection, rule }),
            _ => Err(SensoredError::new(ErrorCode::DetectorContract)),
        }
    }

    fn rule(&self, id: &str) -> Option<&ActiveRule> {
        self.rule_index
            .get(id)
            .map(|&index| &self.resolved.rules[index])
    }

    /// UTF-16 length never exceeds byte length, so short input skips the count.
    fn check_input(&self, text: &str) -> Result<()> {
        let limit = self.resolved.max_input_length;

        if text.len() > limit && utf16_len(text) > limit {
            return Err(SensoredError::new(ErrorCode::InputLimit));
        }

        Ok(())
    }

    fn options(&self, report: bool) -> RenderOptions<'_> {
        RenderOptions {
            report,
            detect_only: self.resolved.detect_only,
            allowlist: &self.resolved.allowlist,
        }
    }

    fn process(&self, text: &str, report: bool) -> Result<Inspection> {
        self.check_input(text)?;

        Ok(process_text(
            text,
            &self.resolved.rules,
            self.resolved.restore,
            self.options(report),
        ))
    }
}

/// Every built-in detector, in the TS `listDetectors()` order.
pub fn list_detectors() -> Vec<DetectorDescription> {
    builtins()
        .iter()
        .map(|detector| DetectorDescription::of(detector.as_ref()))
        .collect()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn detection(start: usize, end: usize) -> Detection {
        Detection {
            start,
            end,
            rule_id: "email".into(),
            entity_type: "email".into(),
            reasons: Vec::new(),
        }
    }

    #[test]
    fn filter_drops_allowlisted_and_placeholder_matches() {
        let redactor = Redactor::new(&json!({
            "rules": { "email": { "action": "redact" } },
            "allowlist": ["a@b.co"],
        }))
        .expect("redactor");

        let text = "a@b.co c@d.co [EMAIL]";
        let kept = redactor
            .filter(
                text,
                vec![detection(0, 6), detection(7, 13), detection(14, 21)],
            )
            .expect("filter");

        assert_eq!(kept, [detection(7, 13)]);
    }

    #[test]
    fn filter_rejects_unknown_rules() {
        let redactor = Redactor::new(&json!({ "rules": { "email": { "action": "redact" } } }))
            .expect("redactor");

        let mut unknown = detection(0, 1);
        unknown.rule_id = "phone".into();

        let error = redactor.filter("a", vec![unknown]).expect_err("contract");

        assert_eq!(error.code, ErrorCode::DetectorContract);
    }

    #[test]
    fn describe_follows_policy_order() {
        let redactor = Redactor::new(&json!({
            "rules": { "phone": { "action": "redact" }, "email": { "action": "redact" } },
        }))
        .expect("redactor");

        let ids: Vec<String> = redactor.describe().into_iter().map(|d| d.id).collect();

        assert_eq!(ids, ["phone", "email"]);
    }
}
