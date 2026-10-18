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

    (1..=12).contains(&two_digits(bytes, 2)) && (1..=31).contains(&two_digits(bytes, 4))
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
