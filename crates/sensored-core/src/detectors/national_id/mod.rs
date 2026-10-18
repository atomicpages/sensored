//! Built-in `national-id` detectors. Mirrors `packages/sensored/src/detectors/national-id/`.
//!
//! One file per detector; see `CONTEXT.md` for the porting recipe.

use std::sync::Arc;

use regex::Regex;

use super::Registry;

mod au_tfn;
mod fj_id;
mod jp_my_number;
mod ke_id;
mod ke_kra_pin;
mod kg_pin;
mod kw_id;
mod kz_iin;
mod lb_id;
mod ma_id;
mod mm_nrc;
mod my_ic;
mod ng_bvn;
mod ng_nin;
mod nl_bsn;
mod nz_driver_license;
mod nz_ird;
mod nz_ird_extra;
mod nz_passport;
mod om_id;
mod pe_dni;
mod pe_ruc;
mod ph_umid;
mod pl_pesel;
mod png_id;
mod qa_id;
mod to_id;
mod uk_nino;
mod uz_stir;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(au_tfn::detector()));
    registry.insert(Arc::new(fj_id::detector()));
    registry.insert(Arc::new(jp_my_number::detector()));
    registry.insert(Arc::new(ke_id::detector()));
    registry.insert(Arc::new(ke_kra_pin::detector()));
    registry.insert(Arc::new(kg_pin::detector()));
    registry.insert(Arc::new(kw_id::detector()));
    registry.insert(Arc::new(kz_iin::detector()));
    registry.insert(Arc::new(lb_id::detector()));
    registry.insert(Arc::new(ma_id::detector()));
    registry.insert(Arc::new(mm_nrc::detector()));
    registry.insert(Arc::new(my_ic::detector()));
    registry.insert(Arc::new(ng_bvn::detector()));
    registry.insert(Arc::new(ng_nin::detector()));
    registry.insert(Arc::new(nl_bsn::detector()));
    registry.insert(Arc::new(nz_driver_license::detector()));
    registry.insert(Arc::new(nz_ird::detector()));
    registry.insert(Arc::new(nz_ird_extra::detector()));
    registry.insert(Arc::new(nz_passport::detector()));
    registry.insert(Arc::new(om_id::detector()));
    registry.insert(Arc::new(pe_dni::detector()));
    registry.insert(Arc::new(pe_ruc::detector()));
    registry.insert(Arc::new(ph_umid::detector()));
    registry.insert(Arc::new(pl_pesel::detector()));
    registry.insert(Arc::new(png_id::detector()));
    registry.insert(Arc::new(qa_id::detector()));
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

/// The ASCII digits of `candidate` as values, skipping separators.
fn ascii_digits(candidate: &str) -> impl Iterator<Item = u32> + '_ {
    candidate
        .bytes()
        .filter(u8::is_ascii_digit)
        .map(|byte| u32::from(byte - b'0'))
}

/// A `YYMMDD...` prefix with month 1-12 and day 1-31, as the TS
/// `structurallyValid` checks parse `slice(2, 4)` and `slice(4, 6)`.
/// The caller guarantees six leading ASCII digits.
fn month_day_valid(candidate: &str) -> bool {
    let bytes = candidate.as_bytes();
    let pair = |at: usize| u32::from(bytes[at] - b'0') * 10 + u32::from(bytes[at + 1] - b'0');

    (1..=12).contains(&pair(2)) && (1..=31).contains(&pair(4))
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
