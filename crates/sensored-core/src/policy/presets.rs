//! Preset expansion. Mirrors `presets.ts` and the preset half of `policy.ts`.

use std::mem::discriminant;

use indexmap::IndexMap;
use serde_json::{Map, Value, json};

use super::json::is_identifier;
use super::validate::PresetRules;
use crate::errors::{ErrorCode, Result, SensoredError};
use crate::types::RuleSetting;

/// A built-in preset: one rule list per version, applied cumulatively.
struct Preset {
    name: &'static str,
    versions: &'static [&'static [&'static str]],
}

fn unknown_preset() -> SensoredError {
    SensoredError::at(ErrorCode::UnknownRule, "presets")
}

/// Merges `presets` in order. A rule two presets set with different actions
/// is a `POLICY_CONFLICT`, unless `explicit` (`config.rules`)
/// has it. Mirrors `resolvePresets`.
pub(super) fn resolve_presets(
    presets: &[&str],
    custom: &IndexMap<String, PresetRules>,
    explicit: &Map<String, Value>,
) -> Result<IndexMap<String, RuleSetting>> {
    let mut merged = IndexMap::new();

    for reference in presets {
        let (name, version) = parse_preset_ref(reference)?;

        if let Some(rules) = custom.get(name) {
            if version.is_some() {
                let info = json!({
                    "preset": name,
                    "reason": "custom_presets_do_not_support_versioning",
                });

                return Err(unknown_preset().with_info(info));
            }

            let rules = rules
                .iter()
                .map(|(id, setting)| (id.as_str(), setting.clone()));
            merge(&mut merged, rules, explicit)?;

            continue;
        }

        for rule_ids in builtin_versions(name, version)? {
            let rules = rule_ids.iter().map(|&id| (id, redact()));
            merge(&mut merged, rules, explicit)?;
        }
    }

    Ok(merged)
}

/// `pii` is `("pii", None)`; `pii@1` is `("pii", Some(1))`. Mirrors
/// `parsePresetRef`.
fn parse_preset_ref(reference: &str) -> Result<(&str, Option<u64>)> {
    let Some((name, version)) = reference.rsplit_once('@') else {
        return Ok((reference, None));
    };

    if !is_identifier(name, true) {
        return Err(unknown_preset());
    }

    if version.is_empty() || !version.bytes().all(|b| b.is_ascii_digit()) {
        return Err(unknown_preset());
    }

    // Overflow lands above `Number.MAX_SAFE_INTEGER`, which TS rejects too.
    match version.parse::<u64>() {
        Ok(version) if version >= 1 => Ok((name, Some(version))),
        _ => Err(unknown_preset()),
    }
}

/// The rule lists a built-in reference applies: every version, or up to and
/// including the requested one.
fn builtin_versions(
    name: &str,
    version: Option<u64>,
) -> Result<&'static [&'static [&'static str]]> {
    let preset = BUILTIN_PRESETS
        .iter()
        .find(|preset| preset.name == name)
        .ok_or_else(unknown_preset)?;

    let Some(version) = version else {
        return Ok(preset.versions);
    };

    let count = preset.versions.len();

    match usize::try_from(version) {
        Ok(version) if version <= count => Ok(&preset.versions[..version]),
        _ => {
            let available: Vec<usize> = (1..=count).collect();
            let info = json!({ "preset": name, "availableVersions": available });

            Err(unknown_preset().with_info(info))
        }
    }
}

/// Mirrors `mergePresetRules`. `"off"` entries never reach here.
fn merge<'r>(
    merged: &mut IndexMap<String, RuleSetting>,
    rules: impl Iterator<Item = (&'r str, RuleSetting)>,
    explicit: &Map<String, Value>,
) -> Result<()> {
    for (id, setting) in rules {
        let conflicts = merged
            .get(id)
            .is_some_and(|existing| discriminant(existing) != discriminant(&setting));

        if conflicts && !explicit.contains_key(id) {
            return Err(SensoredError::at(ErrorCode::PolicyConflict, "presets"));
        }

        merged.insert(id.to_owned(), setting);
    }

    Ok(())
}

/// Every built-in preset rule is `{ action: "redact" }`.
fn redact() -> RuleSetting {
    RuleSetting::Redact {
        replacement: None,
        priority: None,
    }
}

/// `BUILTIN_PRESETS`, in TS order.
static BUILTIN_PRESETS: &[Preset] = &[
    Preset {
        name: "pii",
        versions: &[&[
            "email",
            "phone",
            "payment_card",
            "us_ssn",
            "uk_nino",
            "ca_sin",
            "au_tfn",
            "jp_my_number",
            "person_name_lite",
            "passport",
            "drivers_license",
            "uk_nhs",
            "us_itin",
            "us_ein",
            "nz_ird",
            "iban",
            "eu_vat",
            "swift_bic",
            "uk_sort_code",
            "us_routing",
            "uk_bank_account",
            "address",
            "postal_code",
            "digital_identity",
            "license_plate",
            "de_id",
            "fr_insee",
            "it_codice_fiscale",
            "es_dni",
            "nl_bsn",
            "pl_pesel",
            "za_id",
            "ng_nin",
            "ng_bvn",
            "ke_id",
            "ke_kra_pin",
            "eg_id",
            "gh_card",
            "ma_id",
            "kz_iin",
            "uz_passport",
            "uz_stir",
            "kg_pin",
            "tj_id",
            "tm_passport",
            "ru_passport",
            "ru_snils",
            "ua_passport",
            "ua_inn",
            "cz_id",
            "ro_cnp",
            "hu_id",
            "hu_tax_id",
            "bg_egn",
            "rs_jmbg",
            "ar_dni",
            "ar_cuit",
            "cl_rut",
            "co_cedula",
            "co_nit",
            "pe_dni",
            "pe_ruc",
            "ve_cedula",
            "ve_rif",
            "ec_cedula",
            "uy_cedula",
            "uae_id",
            "sa_id",
            "il_id",
            "tr_id",
            "qa_id",
            "kw_id",
            "bh_cpr",
            "om_id",
            "jo_id",
            "lb_id",
            "nz_driver_license",
            "nz_passport",
            "fj_id",
            "png_id",
            "ws_id",
            "to_id",
            "nz_ird_extra",
            "id_nik",
            "id_npwp",
            "th_id",
            "my_ic",
            "ph_umid",
            "vn_cccd",
            "mm_nrc",
            "crypto_address",
            "health_insurance_id",
            "vin",
            "imei",
            "imsi",
            "tracking_number",
        ]],
    },
    Preset {
        name: "gdpr",
        versions: &[&[
            "email",
            "phone",
            "person_name_lite",
            "iban",
            "eu_vat",
            "uk_nino",
            "uk_nhs",
            "uk_sort_code",
            "uk_bank_account",
            "swift_bic",
            "drivers_license",
            "passport",
            "address",
            "postal_code",
            "digital_identity",
            "license_plate",
            "de_id",
            "fr_insee",
            "it_codice_fiscale",
            "es_dni",
            "nl_bsn",
            "pl_pesel",
            "cz_id",
            "ro_cnp",
            "hu_id",
            "hu_tax_id",
            "bg_egn",
            "rs_jmbg",
            "ru_passport",
            "ru_snils",
            "ua_passport",
            "ua_inn",
            "hr_identifier",
            "hr_screening",
            "hr_compensation",
            "hr_recruitment",
            "legal_case",
            "legal_license",
            "legal_reference",
        ]],
    },
    Preset {
        name: "hipaa",
        versions: &[&[
            "email",
            "phone",
            "payment_card",
            "us_ssn",
            "person_name_lite",
            "passport",
            "drivers_license",
            "us_npi",
            "us_dea",
            "medical_record_number",
            "uk_nhs",
            "us_itin",
            "us_ein",
            "address",
            "postal_code",
            "digital_identity",
            "health_insurance_id",
            "medical_code",
            "clinical_trial_id",
            "medical_device_id",
            "genetic_info",
            "medical_reference",
            "de_id",
            "fr_insee",
            "it_codice_fiscale",
            "es_dni",
            "nl_bsn",
            "pl_pesel",
            "license_plate",
        ]],
    },
    Preset {
        name: "ccpa",
        versions: &[&[
            "email",
            "phone",
            "payment_card",
            "us_ssn",
            "person_name_lite",
            "address",
            "postal_code",
            "digital_identity",
            "license_plate",
            "uk_nino",
            "ca_sin",
            "au_tfn",
            "jp_my_number",
            "uk_nhs",
            "us_itin",
            "us_ein",
            "nz_ird",
            "de_id",
            "fr_insee",
            "it_codice_fiscale",
            "es_dni",
            "nl_bsn",
            "pl_pesel",
            "za_id",
            "ng_nin",
            "ng_bvn",
            "ke_id",
            "ke_kra_pin",
            "eg_id",
            "gh_card",
            "ma_id",
            "kz_iin",
            "uz_passport",
            "uz_stir",
            "kg_pin",
            "tj_id",
            "tm_passport",
            "ru_passport",
            "ru_snils",
            "ua_passport",
            "ua_inn",
            "cz_id",
            "ro_cnp",
            "hu_id",
            "hu_tax_id",
            "bg_egn",
            "rs_jmbg",
            "ar_dni",
            "ar_cuit",
            "cl_rut",
            "co_cedula",
            "co_nit",
            "pe_dni",
            "pe_ruc",
            "ve_cedula",
            "ve_rif",
            "ec_cedula",
            "uy_cedula",
            "uae_id",
            "sa_id",
            "il_id",
            "tr_id",
            "qa_id",
            "kw_id",
            "bh_cpr",
            "om_id",
            "jo_id",
            "lb_id",
            "nz_driver_license",
            "nz_passport",
            "fj_id",
            "png_id",
            "ws_id",
            "to_id",
            "nz_ird_extra",
            "id_nik",
            "id_npwp",
            "th_id",
            "my_ic",
            "ph_umid",
            "vn_cccd",
            "mm_nrc",
            "vin",
            "imei",
            "imsi",
            "tracking_number",
        ]],
    },
    Preset {
        name: "pci-dss",
        versions: &[&[
            "payment_card",
            "iban",
            "card_data",
            "financial_reference",
            "investment_account",
            "payment_gateway_id",
        ]],
    },
    Preset {
        name: "healthcare",
        versions: &[&[
            "email",
            "phone",
            "payment_card",
            "us_ssn",
            "person_name_lite",
            "passport",
            "drivers_license",
            "us_npi",
            "us_dea",
            "medical_record_number",
            "uk_nhs",
            "address",
            "postal_code",
            "health_insurance_id",
            "medical_code",
            "clinical_trial_id",
            "medical_device_id",
            "genetic_info",
            "medical_reference",
        ]],
    },
    Preset {
        name: "finance",
        versions: &[&[
            "email",
            "phone",
            "payment_card",
            "iban",
            "eu_vat",
            "swift_bic",
            "uk_sort_code",
            "us_routing",
            "uk_bank_account",
            "financial_reference",
            "investment_account",
            "card_data",
            "payment_gateway_id",
            "crypto_address",
            "crypto_tx_hash",
        ]],
    },
    Preset {
        name: "education",
        versions: &[&[
            "email",
            "phone",
            "us_ssn",
            "person_name_lite",
            "drivers_license",
            "passport",
        ]],
    },
    Preset {
        name: "soc2",
        versions: &[&[
            "email",
            "phone",
            "payment_card",
            "us_ssn",
            "person_name_lite",
            "ipv4",
            "ipv6",
            "mac_address",
            "url_with_auth",
            "aws_access_key",
            "google_api_key",
            "stripe_api_key",
            "slack_token",
            "github_token",
            "jwt_token",
            "private_key",
            "generic_api_key",
            "crypto_address",
            "crypto_tx_hash",
            "financial_reference",
            "investment_account",
            "card_data",
            "payment_gateway_id",
            "legal_case",
            "legal_license",
            "legal_reference",
            "license_plate",
            "vin",
            "imei",
            "imsi",
            "http_auth_header",
            "url_query_key",
            "digitalocean_token",
            "cloudflare_api_token",
            "sendgrid_api_key",
            "huggingface_token",
            "slack_webhook_url",
            "telegram_bot_token",
            "gitlab_token",
            "npm_token",
            "openai_api_key",
            "anthropic_api_key",
            "shopify_token",
            "twilio_sid",
            "mailchimp_api_key",
            "notion_token",
            "sentry_token",
            "heroku_api_key",
            "linear_api_key",
            "mailgun_api_key",
            "okta_token",
            "square_token",
            "discord_bot_token",
            "datadog_api_key",
            "pagerduty_token",
            "scaleway_key",
        ]],
    },
    Preset {
        name: "security",
        versions: &[&[
            "aws_access_key",
            "google_api_key",
            "stripe_api_key",
            "slack_token",
            "github_token",
            "jwt_token",
            "private_key",
            "generic_api_key",
            "ipv4",
            "ipv6",
            "mac_address",
            "url_with_auth",
            "crypto_address",
            "crypto_tx_hash",
            "http_auth_header",
            "url_query_key",
            "digitalocean_token",
            "cloudflare_api_token",
            "sendgrid_api_key",
            "huggingface_token",
            "slack_webhook_url",
            "telegram_bot_token",
            "gitlab_token",
            "npm_token",
            "openai_api_key",
            "anthropic_api_key",
            "shopify_token",
            "twilio_sid",
            "mailchimp_api_key",
            "notion_token",
            "sentry_token",
            "heroku_api_key",
            "linear_api_key",
            "mailgun_api_key",
            "okta_token",
            "square_token",
            "discord_bot_token",
            "datadog_api_key",
            "pagerduty_token",
            "scaleway_key",
        ]],
    },
];
