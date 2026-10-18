//! Default fake data per entity type. Mirrors `token-generators.ts`.
//!
//! Every value is designed not to match any detector, so token-replaced output
//! is idempotent: emails have no TLD dot, phones have too few digits, checksum
//! IDs fail validation and context-required IDs carry no context label.
//!
//! TS generators take the original text but none use it, so the tokens are
//! static.

use std::collections::HashMap;
use std::sync::LazyLock;

/// The default token for `entity_type`, if it has one.
pub fn default_token(entity_type: &str) -> Option<&'static str> {
    DEFAULT_TOKENS.get(entity_type).map(String::as_str)
}

static DEFAULT_TOKENS: LazyLock<HashMap<&'static str, String>> = LazyLock::new(|| {
    let mut tokens: HashMap<&'static str, String> = LITERAL_TOKENS
        .iter()
        .map(|&(entity_type, token)| (entity_type, token.to_owned()))
        .collect();

    tokens.extend(generated_tokens());

    tokens
});

fn zeros(count: usize) -> String {
    "0".repeat(count)
}

/// Tokens TS builds with `"0".repeat(n)` (TruffleHog-ported detectors).
fn generated_tokens() -> [(&'static str, String); 23] {
    [
        ("digitalocean_token", format!("doo_v1_{}", zeros(64))),
        ("cloudflare_api_token", format!("cfk_{}", zeros(20))),
        (
            "sendgrid_api_key",
            format!("SG.{}.{}", zeros(22), zeros(40)),
        ),
        ("huggingface_token", format!("hf_{}", zeros(34))),
        (
            "slack_webhook_url",
            format!(
                "https://hooks.slack.com/services/T00000000/B00000000/{}",
                zeros(24)
            ),
        ),
        ("telegram_bot_token", format!("0000000000:AA{}", zeros(35))),
        ("gitlab_token", format!("glpat-{}", zeros(20))),
        ("npm_token", format!("npm_{}", zeros(36))),
        (
            "openai_api_key",
            format!("sk-{}T3BlbkFJ{}", zeros(20), zeros(20)),
        ),
        ("anthropic_api_key", format!("sk-ant-api03-{}AA", zeros(93))),
        ("shopify_token", format!("shpat_{}", zeros(38))),
        ("twilio_sid", format!("AC{}", zeros(32))),
        ("mailchimp_api_key", format!("{}-us0", zeros(32))),
        ("notion_token", format!("ntn_{}", zeros(43))),
        ("sentry_token", format!("sntrys_eyJ{}", zeros(197))),
        ("heroku_api_key", format!("HRKU-{}", zeros(60))),
        ("linear_api_key", format!("lin_api_{}", zeros(40))),
        ("mailgun_api_key", format!("key-{}", zeros(32))),
        ("okta_token", format!("00{}", zeros(40))),
        ("square_token", format!("sq0atp-{}", zeros(36))),
        (
            "discord_bot_token",
            format!("{}.{}.{}", zeros(24), zeros(6), zeros(27)),
        ),
        ("datadog_api_key", zeros(40)),
        ("pagerduty_token", format!("y{}", zeros(19))),
    ]
}

const LITERAL_TOKENS: &[(&str, &str)] = &[
    ("email", "redacted@example"),
    ("phone", "+0-000-0000"),
    ("payment_card", "0000-0000-0000-0001"),
    ("us_ssn", "000-00-0001"),
    ("uk_nino", "DA000000A"),
    ("ca_sin", "000-000-001"),
    ("au_tfn", "000 000 001"),
    ("jp_my_number", "0000 0000 0001"),
    ("person_name", "Redacted Person"),
    ("person_name_lite", "Redacted Person"),
    ("passport", "REDACTED00"),
    ("drivers_license", "REDACTED0"),
    ("iban", "XX00XXXX000000000000000"),
    ("eu_vat", "XX000000001"),
    ("uk_nhs", "000 000 0001"),
    ("us_itin", "900-70-0001"),
    ("us_ein", "00-0000001"),
    ("nz_ird", "000-000-001"),
    ("swift_bic", "REDACTED00XXX"),
    ("uk_sort_code", "00-00-01"),
    ("us_routing", "000000001"),
    ("uk_bank_account", "00000001"),
    ("us_npi", "0000000001"),
    ("us_dea", "BA0000000"),
    ("medical_record_number", "MRN000001"),
    ("ipv4", "0.0.0.1"),
    ("ipv6", "0000:0000:0000:0000:0000:0000:0000:0001"),
    ("mac_address", "00:00:00:00:00:01"),
    ("url_with_auth", "https://redacted@example"),
    ("aws_access_key", "AKIAXXXXXXXXXXXXXXXX"),
    ("google_api_key", "AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"),
    ("stripe_api_key", "sk_live_xxxxxxxxxxxxxxxxxxxxxxxx"),
    ("slack_token", "xoxb-0000000000-0000000000"),
    ("github_token", "ghp_000000000000000000000000000000000000"),
    (
        "jwt_token",
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJyZWRhY3RlZCJ9.0000000000000000",
    ),
    (
        "private_key",
        "-----BEGIN REDACTED KEY-----\n-----END REDACTED KEY-----",
    ),
    ("generic_api_key", "redacted-key-000000000000"),
    ("http_auth_header", "cmVkYWN0ZWQ6cmVkYWN0ZWQ="),
    ("url_query_key", "cmVkYWN0ZWQ"),
    ("address", "123 Redacted Ave"),
    ("postal_code", "XXX"),
    ("card_data", "CVV: 000"),
    ("financial_reference", "TXN-ID 00000000"),
    ("investment_account", "ISA ACCOUNT NO 000000"),
    ("payment_gateway_id", "tok_000000000000000000000000"),
    ("crypto_address", "XREDACTED0000000000000000000"),
    (
        "crypto_tx_hash",
        "0000000000000000000000000000000000000000000000000000000000000000",
    ),
    ("clinical_trial_id", "PARTICIPANT ID AA0000"),
    ("genetic_info", "rs000000"),
    ("health_insurance_id", "CLAIM 00000000"),
    ("medical_code", "A00"),
    ("medical_device_id", "DEVICE SERIAL 00000000"),
    ("medical_reference", "LAB ID 000000"),
    ("hr_compensation", "$0.00"),
    ("hr_identifier", "EMP0000"),
    ("hr_recruitment", "APP0000"),
    ("hr_screening", "BGC0000"),
    ("legal_case", "CASE000"),
    ("legal_license", "BAR000"),
    ("legal_reference", "NDA000"),
    ("digital_identity", "redacted_user"),
    ("license_plate", "AB00CD"),
    ("ar_cuit", "00-00000000-0"),
    ("ar_dni", "00000000"),
    ("bg_egn", "0000000000"),
    ("bh_cpr", "000000000"),
    ("cl_rut", "00.000.000-1"),
    ("co_cedula", "000000"),
    ("co_nit", "000000000-0"),
    ("cz_id", "000000/0000"),
    ("de_id", "AAAA0000000"),
    ("ec_cedula", "0000000000"),
    ("eg_id", "100000000000000"),
    ("es_dni", "00000000A"),
    ("fj_id", "AAAAAAAA"),
    ("fr_insee", "0000000000000 00"),
    ("gh_card", "GHA-000000000-0"),
    ("hu_id", "000000AA"),
    ("hu_tax_id", "0000000000"),
    ("id_nik", "0000000000000000"),
    ("id_npwp", "00.000.000.0-000.000"),
    ("il_id", "000000000"),
    ("it_codice_fiscale", "AAAAAA00A00A000A"),
    ("jo_id", "0000000000"),
    ("ke_id", "0000000"),
    ("ke_kra_pin", "A000000000A"),
    ("kg_pin", "00000000000000"),
    ("kw_id", "000000000000"),
    ("kz_iin", "000000000000"),
    ("lb_id", "0000000"),
    ("ma_id", "A000000"),
    ("mm_nrc", "0/Aa(N)000000"),
    ("my_ic", "000000-00-0000"),
    ("ng_bvn", "00000000000"),
    ("ng_nin", "00000000000"),
    ("nl_bsn", "000.000.001"),
    ("nz_driver_license", "AA000000"),
    ("nz_ird_extra", "00000000"),
    ("nz_passport", "AA000000"),
    ("om_id", "00000000"),
    ("pe_dni", "00000000"),
    ("pe_ruc", "00000000000"),
    ("ph_umid", "0000-0000000-0"),
    ("pl_pesel", "00000000001"),
    ("png_id", "AAAAAAAA"),
    ("qa_id", "00000000000"),
    ("ro_cnp", "0000000000000"),
    ("rs_jmbg", "0000000000000"),
    ("ru_passport", "0000 000000"),
    ("ru_snils", "000-000-000 00"),
    ("sa_id", "1000000000"),
    ("th_id", "0000000000000"),
    ("tj_id", "000000000"),
    ("tm_passport", "A0000000"),
    ("to_id", "AAAAAAAA"),
    ("tr_id", "10000000000"),
    ("ua_inn", "0000000000"),
    ("ua_passport", "AA000000"),
    ("uae_id", "784-0000-0000000-0"),
    ("uy_cedula", "0.000.000-0"),
    ("uz_passport", "AA0000000"),
    ("uz_stir", "000000000"),
    ("ve_cedula", "V-00000000"),
    ("ve_rif", "V-00000000-0"),
    ("vn_cccd", "000000000000"),
    ("ws_id", "00000000"),
    ("za_id", "0000000000000"),
    ("vin", "00000000000000000"),
    ("imei", "000000000000001"),
    ("imsi", "000000000000001"),
    ("tracking_number", "00000000000000000000"),
    ("scaleway_key", "00000000-0000-0000-0000-000000000000"),
];
