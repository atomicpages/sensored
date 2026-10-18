//! Built-in `hr` detectors. Mirrors `packages/sensored/src/detectors/hr/`.
//!
//! One file per detector; the porting recipe is in `national_id/CONTEXT.md`.

use std::sync::Arc;

use super::{Registry, has_ascii_digit, regex};

mod hr_compensation;
mod hr_identifier;
mod hr_recruitment;
mod hr_screening;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(hr_compensation::HrCompensation));
    registry.insert(Arc::new(hr_identifier::detector()));
    registry.insert(Arc::new(hr_recruitment::detector()));
    registry.insert(Arc::new(hr_screening::detector()));
}

#[cfg(test)]
use super::test_support;
