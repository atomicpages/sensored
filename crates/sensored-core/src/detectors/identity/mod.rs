//! Built-in `identity` detectors. Mirrors `packages/sensored/src/detectors/identity/`.

use std::sync::Arc;

use super::Registry;

mod digital_identity;
mod drivers_license;
mod imei;
mod imsi;
mod license_plate;
mod passport;
mod vin;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(digital_identity::DigitalIdentity));
    registry.insert(Arc::new(drivers_license::detector()));
    registry.insert(Arc::new(imei::detector()));
    registry.insert(Arc::new(imsi::detector()));
    registry.insert(Arc::new(license_plate::detector()));
    registry.insert(Arc::new(passport::detector()));
    registry.insert(Arc::new(vin::detector()));
}

#[cfg(test)]
pub(crate) use super::test_support;
