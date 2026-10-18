//! Built-in `person` detectors. Mirrors `packages/sensored/src/detectors/person/`.

use std::sync::Arc;

use super::Registry;

mod bloom;
mod data;
mod lexicon;
mod person_name;
mod person_name_lite;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(person_name::PersonName));
    registry.insert(Arc::new(person_name_lite::PersonNameLite));
}
