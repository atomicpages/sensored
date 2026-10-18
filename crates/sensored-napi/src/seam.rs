//! The hybrid seam: `collect` core detections, let JS add its own, then
//! `render` them all. Mirrors the core `Redactor`'s complete-string path,
//! split at `engine::render_detected`.
//!
//! Offsets here are UTF-8 bytes; the class in `redactor.rs` converts.

use std::collections::HashMap;

use sensored_core::engine::{RenderOptions, detect_matches, render_detected};
use sensored_core::errors::{ErrorCode, Result, SensoredError};
use sensored_core::policy::ResolvedPolicy;
use sensored_core::text::utf16_len;
use sensored_core::types::{ActiveRule, AppliedMatch, Detection, Inspection, RestorationContext};

pub struct Seam {
    resolved: ResolvedPolicy,
    /// Rule id to its index in `resolved.rules`.
    rule_index: HashMap<String, usize>,
}

impl Seam {
    pub fn new(resolved: ResolvedPolicy) -> Self {
        let rule_index = resolved
            .rules
            .iter()
            .enumerate()
            .map(|(index, rule)| (rule.detector.id().to_owned(), index))
            .collect();

        Self {
            resolved,
            rule_index,
        }
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

    /// Renders `detections`, which may mix `collect`'s output with matches
    /// from JS detectors. A rule id outside the enabled rules, or an empty
    /// span, is a `DETECTOR_CONTRACT` error.
    pub fn render(
        &self,
        text: &str,
        detections: Vec<Detection>,
        report: bool,
    ) -> Result<Inspection> {
        self.check_input(text)?;

        let detected = detections
            .into_iter()
            .map(|detection| self.apply(detection))
            .collect::<Result<Vec<_>>>()?;

        let resolved = &self.resolved;
        let mut restoration =
            (resolved.restore && !resolved.detect_only).then(|| RestorationContext::new(false));

        let options = RenderOptions {
            report,
            detect_only: resolved.detect_only,
            allowlist: &resolved.allowlist,
        };

        let rendered =
            render_detected(text, detected, text.len(), 0, restoration.as_mut(), options);

        Ok(Inspection {
            text: rendered.segments.iter().map(|s| s.text.as_ref()).collect(),
            groups: rendered.groups,
            map: restoration.map(|context| context.map),
        })
    }

    fn apply(&self, detection: Detection) -> Result<AppliedMatch<'_>> {
        let rule = self.rule(&detection.rule_id)?;

        if detection.start >= detection.end {
            return Err(SensoredError::new(ErrorCode::DetectorContract));
        }

        Ok(AppliedMatch { detection, rule })
    }

    fn rule(&self, id: &str) -> Result<&ActiveRule> {
        self.rule_index
            .get(id)
            .map(|&index| &self.resolved.rules[index])
            .ok_or_else(|| SensoredError::new(ErrorCode::DetectorContract))
    }

    /// Same check as the core `Redactor`. UTF-16 length never exceeds byte
    /// length, so short input skips the count.
    fn check_input(&self, text: &str) -> Result<()> {
        let limit = self.resolved.max_input_length;

        if text.len() > limit && utf16_len(text) > limit {
            return Err(SensoredError::new(ErrorCode::InputLimit));
        }

        Ok(())
    }
}
