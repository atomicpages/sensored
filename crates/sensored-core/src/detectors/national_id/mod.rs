//! Built-in `national-id` detectors. Mirrors `packages/sensored/src/detectors/national-id/`.
//!
//! One file per detector; see `CONTEXT.md` for the porting recipe.

use std::sync::Arc;

use regex::Regex;

use super::Registry;

mod au_tfn;
mod fj_id;
mod ma_id;
mod png_id;
mod ro_cnp;
mod rs_jmbg;
mod ru_passport;
mod ru_snils;
mod sa_id;
mod th_id;
mod tj_id;
mod tm_passport;
mod to_id;
mod tr_id;
mod ua_inn;
mod ua_passport;
mod uae_id;
mod uk_nhs;
mod uk_nino;
mod us_ein;
mod us_itin;
mod us_ssn;
mod uy_cedula;
mod uz_passport;
mod uz_stir;
mod ve_cedula;
mod ve_rif;
mod vn_cccd;
mod ws_id;
mod za_id;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(au_tfn::detector()));
    registry.insert(Arc::new(fj_id::detector()));
    registry.insert(Arc::new(ma_id::detector()));
    registry.insert(Arc::new(png_id::detector()));
    registry.insert(Arc::new(ro_cnp::detector()));
    registry.insert(Arc::new(rs_jmbg::detector()));
    registry.insert(Arc::new(ru_passport::detector()));
    registry.insert(Arc::new(ru_snils::detector()));
    registry.insert(Arc::new(sa_id::detector()));
    registry.insert(Arc::new(th_id::detector()));
    registry.insert(Arc::new(tj_id::detector()));
    registry.insert(Arc::new(tm_passport::detector()));
    registry.insert(Arc::new(to_id::detector()));
    registry.insert(Arc::new(tr_id::detector()));
    registry.insert(Arc::new(ua_inn::detector()));
    registry.insert(Arc::new(ua_passport::detector()));
    registry.insert(Arc::new(uae_id::detector()));
    registry.insert(Arc::new(uk_nhs::detector()));
    registry.insert(Arc::new(uk_nino::detector()));
    registry.insert(Arc::new(us_ein::detector()));
    registry.insert(Arc::new(us_itin::detector()));
    registry.insert(Arc::new(us_ssn::detector()));
    registry.insert(Arc::new(uy_cedula::detector()));
    registry.insert(Arc::new(uz_passport::detector()));
    registry.insert(Arc::new(uz_stir::detector()));
    registry.insert(Arc::new(ve_cedula::detector()));
    registry.insert(Arc::new(ve_rif::detector()));
    registry.insert(Arc::new(vn_cccd::detector()));
    registry.insert(Arc::new(ws_id::detector()));
    registry.insert(Arc::new(za_id::detector()));
}

/// Compiles a static detector pattern.
///
/// # Panics
/// If `pattern` does not compile; patterns are static detector data.
fn regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("valid pattern")
}

/// The two ASCII digits at `at` as a number, as `Number.parseInt(s.slice(at,
/// at + 2), 10)` reads them. Callers check the length; patterns guarantee digits.
fn two_digits(bytes: &[u8], at: usize) -> u8 {
    (bytes[at] - b'0') * 10 + (bytes[at + 1] - b'0')
}

#[cfg(test)]
mod test_support {
    use crate::detector::Detector;
    use crate::types::Detection;

    pub fn detect(detector: &dyn Detector, text: &str) -> Vec<Detection> {
        let mut out = Vec::new();
        detector.detect(text, &mut out);

        out
    }

    /// The matched substrings, in order.
    pub fn values<'a>(detector: &dyn Detector, text: &'a str) -> Vec<&'a str> {
        detect(detector, text)
            .iter()
            .map(|d| &text[d.start..d.end])
            .collect()
    }

    /// The byte spans, in order.
    pub fn spans(detector: &dyn Detector, text: &str) -> Vec<(usize, usize)> {
        detect(detector, text)
            .iter()
            .map(|d| (d.start, d.end))
            .collect()
    }

    /// The label-placement cases every `ContextDetector` test in TS repeats:
    /// `value` is found next to `label` and rejected without it.
    pub fn assert_context_shape(detector: &dyn Detector, label: &str, value: &str) {
        let lower = label.to_lowercase();
        let upper = label.to_uppercase();

        let found = [
            format!("{label}: {value}"),
            format!("{lower}: {value}"),
            format!("{upper}: {value}"),
            format!("{label}:{value}"),
            format!("{label}# {value}"),
            format!("{label}#{value}"),
            format!("{label}:\t{value}"),
            format!("{label}: \t {value}"),
            format!("{value} ({label})"),
            format!("{value} {label}"),
            format!("{value}\t({label})"),
            format!("{label}: {value}."),
            format!("({label}: {value})"),
        ];

        for text in &found {
            assert_eq!(values(detector, text), [value], "{text:?}");
        }

        let missed = [
            value.to_owned(),
            format!("Reference: {value}"),
            format!("my{label}: {value}"),
            format!("{label}x: {value}"),
            format!("{label}:\n{value}"),
            format!("{label}:         {value}"),
            format!("{value}({label})"),
            format!("{value} ({label}"),
            format!("{label}: {value}_"),
            format!("_{label}: {value}"),
            format!("{label}: {value}\u{301}"),
        ];

        for text in &missed {
            assert!(values(detector, text).is_empty(), "{text:?}");
        }
    }
}
