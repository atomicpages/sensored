//! Built-in `token` detectors. Mirrors `packages/sensored/src/detectors/token/`.
//!
//! One file per detector; see `CONTEXT.md` for how each TS kind is ported.

use std::sync::Arc;

use regex::Regex;

use super::Registry;
use crate::types::Detection;

mod anthropic_api_key;
mod datadog_api_key;
mod discord_bot_token;
mod generic_api_key;
mod github_token;
mod gitlab_token;
mod heroku_api_key;
pub(crate) mod http_auth_header;
mod huggingface_token;
mod jwt_token;
mod linear_api_key;
mod mailchimp_api_key;
mod mailgun_api_key;
mod notion_token;
mod npm_token;
mod okta_token;
mod openai_api_key;
mod pagerduty_token;
mod private_key;
mod scaleway_key;
mod sendgrid_api_key;
mod sentry_token;
mod shopify_token;
mod slack_webhook_url;
mod square_token;
mod telegram_bot_token;
mod twilio_sid;

#[cfg(test)]
mod tests;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(anthropic_api_key::detector()));
    registry.insert(Arc::new(datadog_api_key::detector()));
    registry.insert(Arc::new(discord_bot_token::detector()));
    registry.insert(Arc::new(generic_api_key::GenericApiKeyDetector));
    registry.insert(Arc::new(github_token::detector()));
    registry.insert(Arc::new(gitlab_token::detector()));
    registry.insert(Arc::new(heroku_api_key::detector()));
    registry.insert(Arc::new(http_auth_header::detector()));
    registry.insert(Arc::new(huggingface_token::detector()));
    registry.insert(Arc::new(jwt_token::JwtTokenDetector));
    registry.insert(Arc::new(linear_api_key::detector()));
    registry.insert(Arc::new(mailchimp_api_key::detector()));
    registry.insert(Arc::new(mailgun_api_key::detector()));
    registry.insert(Arc::new(notion_token::detector()));
    registry.insert(Arc::new(npm_token::detector()));
    registry.insert(Arc::new(okta_token::detector()));
    registry.insert(Arc::new(openai_api_key::detector()));
    registry.insert(Arc::new(pagerduty_token::detector()));
    registry.insert(Arc::new(private_key::PrivateKeyDetector));
    registry.insert(Arc::new(scaleway_key::detector()));
    registry.insert(Arc::new(sendgrid_api_key::detector()));
    registry.insert(Arc::new(sentry_token::detector()));
    registry.insert(Arc::new(shopify_token::detector()));
    registry.insert(Arc::new(slack_webhook_url::detector()));
    registry.insert(Arc::new(square_token::detector()));
    registry.insert(Arc::new(telegram_bot_token::detector()));
    registry.insert(Arc::new(twilio_sid::detector()));
}

/// Compiles a static detector pattern.
///
/// # Panics
/// If `pattern` does not compile; patterns are static detector data.
fn regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("valid pattern")
}

/// A detection whose rule id and entity type are both `id`.
fn detection(id: &str, start: usize, end: usize, reasons: &[&str]) -> Detection {
    Detection {
        start,
        end,
        rule_id: id.to_owned(),
        entity_type: id.to_owned(),
        reasons: reasons.iter().map(|reason| (*reason).to_owned()).collect(),
    }
}

/// JS `\s` and `\S` for patterns built under `(?i-u)`: Unicode is switched
/// back on for the class, which ASCII-only mode cannot express.
fn js_space() -> String {
    format!("(?u:[{}])", crate::text::JS_SPACE_CLASS)
}

fn js_non_space() -> String {
    format!("(?u:[^{}])", crate::text::JS_SPACE_CLASS)
}

#[cfg(test)]
mod test_support {
    use crate::detector::Detector;

    /// The matched substrings, in order.
    pub fn values<'a>(detector: &dyn Detector, text: &'a str) -> Vec<&'a str> {
        let mut out = Vec::new();
        detector.detect(text, &mut out);

        out.iter().map(|d| &text[d.start..d.end]).collect()
    }
}
