//! Shape tests for the format-only and keyword token detectors. Values are
//! built from repeated filler so no committed string looks like a real secret.

use super::test_support::values;
use super::*;
use crate::detector::Detector;

fn fill(prefix: &str, ch: char, len: usize) -> String {
    format!("{prefix}{}", ch.to_string().repeat(len))
}

/// `value` is found alone, in a sentence and before a period, and is
/// rejected when glued to a letter or `_` before it or a letter after it
/// (`é`: outside every token class, so the match cannot absorb it).
fn assert_format(detector: &dyn Detector, value: &str) {
    let id = detector.id();

    for text in [
        value.to_owned(),
        format!("token {value} here"),
        format!("({value})."),
    ] {
        assert_eq!(values(detector, &text), [value], "{id}: {text}");
    }

    for text in [
        format!("x{value}"),
        format!("_{value}"),
        format!("{value}é"),
    ] {
        assert!(values(detector, &text).is_empty(), "{id}: {text}");
    }
}

#[test]
fn format_detectors_find_their_tokens() {
    let cases: Vec<(Box<dyn Detector>, String)> = vec![
        (
            Box::new(anthropic_api_key::detector()),
            format!("{}AA", fill("sk-ant-api03-", 'a', 93)),
        ),
        (Box::new(github_token::detector()), fill("ghp_", 'a', 36)),
        (Box::new(gitlab_token::detector()), fill("glpat-", 'a', 20)),
        (Box::new(heroku_api_key::detector()), fill("HRKU-", 'a', 60)),
        (
            Box::new(huggingface_token::detector()),
            fill("hf_", 'a', 34),
        ),
        (
            Box::new(linear_api_key::detector()),
            fill("lin_api_", 'a', 40),
        ),
        (
            Box::new(mailchimp_api_key::detector()),
            format!("{}-us12", fill("", 'a', 32)),
        ),
        (Box::new(notion_token::detector()), fill("ntn_", 'a', 43)),
        (Box::new(npm_token::detector()), fill("npm_", 'a', 36)),
        (
            Box::new(openai_api_key::detector()),
            format!("sk-proj-aaaaT3BlbkFJ{}", fill("", 'a', 20)),
        ),
        (
            Box::new(sendgrid_api_key::detector()),
            format!("SG.{}.{}", fill("", 'a', 22), fill("", 'a', 43)),
        ),
        (Box::new(sentry_token::detector()), fill("sntryu_", 'a', 64)),
        (Box::new(shopify_token::detector()), fill("shpat_", 'a', 32)),
        (
            Box::new(slack_webhook_url::detector()),
            format!(
                "https://hooks.slack.com/services/T00000000/B00000000/{}",
                fill("", 'X', 24)
            ),
        ),
        (
            Box::new(telegram_bot_token::detector()),
            fill("123456:AA", 'a', 35),
        ),
        (Box::new(twilio_sid::detector()), fill("AC", '0', 32)),
    ];

    for (detector, value) in &cases {
        assert_format(detector.as_ref(), value);
    }
}

#[test]
fn format_detectors_reject_near_misses() {
    let cases: Vec<(Box<dyn Detector>, String)> = vec![
        (Box::new(github_token::detector()), fill("ghx_", 'a', 36)),
        (Box::new(github_token::detector()), fill("ghp_", 'a', 35)),
        (Box::new(heroku_api_key::detector()), fill("HRKU-", 'a', 59)),
        (Box::new(npm_token::detector()), fill("npm_", 'a', 37)),
        (Box::new(twilio_sid::detector()), fill("AC", 'g', 32)),
        (Box::new(openai_api_key::detector()), fill("sk-", 'a', 40)),
        (Box::new(sentry_token::detector()), fill("sntryu_", 'g', 64)),
    ];

    for (detector, text) in &cases {
        assert!(values(detector.as_ref(), text).is_empty(), "{text}");
    }
}

#[test]
fn reasons_name_the_rule() {
    let detector = github_token::detector();
    let mut out = Vec::new();
    detector.detect(&fill("ghp_", 'a', 36), &mut out);

    assert_eq!(out[0].reasons, ["github_token.format"]);
}

#[test]
fn keyword_detectors_need_their_keyword() {
    let cases: Vec<(Box<dyn Detector>, &str, String)> = vec![
        (
            Box::new(datadog_api_key::detector()),
            "DataDog",
            fill("", 'a', 32),
        ),
        (
            Box::new(discord_bot_token::detector()),
            "discord",
            format!(
                "{}.{}.{}",
                fill("", 'a', 24),
                fill("", 'a', 6),
                fill("", 'a', 27)
            ),
        ),
        (
            Box::new(mailgun_api_key::detector()),
            "mailgun",
            fill("key-", 'a', 32),
        ),
        (
            Box::new(okta_token::detector()),
            "okta",
            fill("00", 'a', 40),
        ),
        (
            Box::new(pagerduty_token::detector()),
            "pd_",
            fill("a", 'b', 19),
        ),
        (
            Box::new(scaleway_key::detector()),
            "scaleway",
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa".to_owned(),
        ),
        (
            Box::new(square_token::detector()),
            "Square",
            fill("sq0atp-", 'a', 36),
        ),
    ];

    for (detector, keyword, value) in &cases {
        let before = format!("{keyword} key: {value}");
        let after = format!("{value} ({keyword})");

        assert_eq!(
            values(detector.as_ref(), &before),
            [value.as_str()],
            "{before}"
        );
        assert_eq!(
            values(detector.as_ref(), &after),
            [value.as_str()],
            "{after}"
        );
        assert!(values(detector.as_ref(), value).is_empty(), "{value}");

        // Keywords count only within 40 UTF-16 units of the match.
        let far = format!("{keyword}{} {value}", " ".repeat(40));

        assert!(values(detector.as_ref(), &far).is_empty(), "{far}");
    }
}
