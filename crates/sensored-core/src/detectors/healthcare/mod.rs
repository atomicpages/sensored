//! Built-in `healthcare` detectors. Mirrors `packages/sensored/src/detectors/healthcare/`.
//!
//! One file per detector; the porting recipe is in `national_id/CONTEXT.md`.

use std::sync::Arc;

use regex::Regex;

use super::{Registry, regex};
use crate::text::JS_SPACE_CLASS;

mod clinical_trial_id;
mod genetic_info;
mod health_insurance_id;
mod medical_code;
mod medical_device_id;
mod medical_record_number;
mod medical_reference;
mod us_dea;
mod us_npi;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(clinical_trial_id::detector()));
    registry.insert(Arc::new(genetic_info::detector()));
    registry.insert(Arc::new(health_insurance_id::detector()));
    registry.insert(Arc::new(medical_code::detector()));
    registry.insert(Arc::new(medical_device_id::detector()));
    registry.insert(Arc::new(medical_record_number::detector()));
    registry.insert(Arc::new(medical_reference::detector()));
    registry.insert(Arc::new(us_dea::detector()));
    registry.insert(Arc::new(us_npi::detector()));
}

/// Compiles a TS `/.../gi` pattern (no `u` flag). The whole pattern runs in
/// `(?i-u:...)`, so case folding, `\d` and `[A-Z]` stay ASCII as in JS (no
/// Kelvin sign for `K`, no long s for `S`). JS `\s` is written `{s}` and
/// `[-\s]` is written `{sep}`; both expand to Unicode classes.
fn ts_ascii_ci(source: &str) -> Regex {
    let space = format!("(?u:[{JS_SPACE_CLASS}])");
    let separator = format!("(?u:[-{JS_SPACE_CLASS}])");

    let source = source.replace("{sep}", &separator).replace("{s}", &space);

    regex(&format!("(?i-u:{source})"))
}

#[cfg(test)]
use super::test_support;
