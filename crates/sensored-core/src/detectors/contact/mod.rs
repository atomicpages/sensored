//! Built-in `contact` detectors. Mirrors `packages/sensored/src/detectors/contact/`.

use std::sync::Arc;

use super::Registry;
use crate::types::Detection;

mod address;
mod email;
mod phone;
mod postal_code;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(address::detector()));
    registry.insert(Arc::new(email::EmailDetector));
    registry.insert(Arc::new(phone::PhoneDetector));
    registry.insert(Arc::new(postal_code::PostalCodeDetector));
}

/// A detection whose rule id and entity type are both `id`.
fn detection(id: &'static str, start: usize, end: usize, reasons: &[&'static str]) -> Detection {
    Detection {
        start,
        end,
        rule_id: id.into(),
        entity_type: id.into(),
        reasons: reasons.iter().map(|reason| (*reason).into()).collect(),
    }
}

/// The text of every match `detector` finds in `text`.
#[cfg(test)]
fn found<'a>(detector: &dyn crate::detector::Detector, text: &'a str) -> Vec<&'a str> {
    let mut out = Vec::new();
    detector.detect(text, &mut out);

    out.iter().map(|d| &text[d.start..d.end]).collect()
}
