//! Built-in `national-id` detectors. Mirrors `packages/sensored/src/detectors/national-id/`.
//!
//! One file per detector; see `CONTEXT.md` for the porting recipe.

use std::sync::Arc;

use regex::Regex;

use super::Registry;

mod ar_cuit;
mod ar_dni;
mod au_tfn;
mod bg_egn;
mod bh_cpr;
mod ca_sin;
mod cl_rut;
mod co_cedula;
mod co_nit;
mod cz_id;
mod de_id;
mod ec_cedula;
mod eg_id;
mod es_dni;
mod fj_id;
mod fr_insee;
mod gh_card;
mod hu_id;
mod hu_tax_id;
mod id_nik;
mod id_npwp;
mod il_id;
mod it_codice_fiscale;
mod jo_id;
mod ma_id;
mod png_id;
mod to_id;
mod uk_nino;
mod uz_stir;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(ar_cuit::detector()));
    registry.insert(Arc::new(ar_dni::detector()));
    registry.insert(Arc::new(au_tfn::detector()));
    registry.insert(Arc::new(bg_egn::detector()));
    registry.insert(Arc::new(bh_cpr::detector()));
    registry.insert(Arc::new(ca_sin::detector()));
    registry.insert(Arc::new(cl_rut::detector()));
    registry.insert(Arc::new(co_cedula::detector()));
    registry.insert(Arc::new(co_nit::detector()));
    registry.insert(Arc::new(cz_id::detector()));
    registry.insert(Arc::new(de_id::detector()));
    registry.insert(Arc::new(ec_cedula::detector()));
    registry.insert(Arc::new(eg_id::detector()));
    registry.insert(Arc::new(es_dni::detector()));
    registry.insert(Arc::new(fj_id::detector()));
    registry.insert(Arc::new(fr_insee::detector()));
    registry.insert(Arc::new(gh_card::detector()));
    registry.insert(Arc::new(hu_id::detector()));
    registry.insert(Arc::new(hu_tax_id::detector()));
    registry.insert(Arc::new(id_nik::detector()));
    registry.insert(Arc::new(id_npwp::detector()));
    registry.insert(Arc::new(il_id::detector()));
    registry.insert(Arc::new(it_codice_fiscale::detector()));
    registry.insert(Arc::new(jo_id::detector()));
    registry.insert(Arc::new(ma_id::detector()));
    registry.insert(Arc::new(png_id::detector()));
    registry.insert(Arc::new(to_id::detector()));
    registry.insert(Arc::new(uk_nino::detector()));
    registry.insert(Arc::new(uz_stir::detector()));
}

/// Compiles a static detector pattern.
///
/// # Panics
/// If `pattern` does not compile; patterns are static detector data.
fn regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("valid pattern")
}

/// The value of ASCII digits, as `Number.parseInt(slice, 10)` reads the
/// digit-only slices the detector patterns guarantee.
fn number(digits: &[u8]) -> u64 {
    digits
        .iter()
        .fold(0, |value, digit| value * 10 + u64::from(digit - b'0'))
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
