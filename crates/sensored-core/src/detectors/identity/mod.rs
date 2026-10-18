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
    registry.insert(Arc::new(license_plate::detector()));
    registry.insert(Arc::new(drivers_license::detector()));
    registry.insert(Arc::new(vin::detector()));
    registry.insert(Arc::new(imei::detector()));
    registry.insert(Arc::new(imsi::detector()));
    registry.insert(Arc::new(passport::detector()));
}

#[cfg(test)]
pub(crate) mod test_support {
    use crate::detector::Detector;

    pub fn spans(detector: &dyn Detector, text: &str) -> Vec<(usize, usize)> {
        let mut out = Vec::new();
        detector.detect(text, &mut out);

        out.iter().map(|d| (d.start, d.end)).collect()
    }

    pub fn values<'a>(detector: &dyn Detector, text: &'a str) -> Vec<&'a str> {
        spans(detector, text)
            .into_iter()
            .map(|(start, end)| &text[start..end])
            .collect()
    }
}
