//! `resolve_replacement` against the recorded groups in `render.json` and
//! `offsets.json`. Cases with presets or `detectOnly` are skipped: presets need
//! policy resolution, and detect-only output never renders.

mod support;

use indexmap::IndexMap;
use sensored_core::render::resolve_replacement;
use sensored_core::token_generators::default_token;
use sensored_core::types::{ActiveRule, AppliedMatch, Detection, RestorationContext, RuleSetting};
use serde_json::Value;

/// Returns `(ran, skipped)`.
fn check_file(file: &str) -> (usize, usize) {
    let registry = support::stub_registry();
    let (mut ran, mut skipped) = (0, 0);

    for case in support::golden::<support::RenderCase>(file) {
        let config = &case.config;

        if config.get("presets").is_some() || config["detectOnly"] == Value::Bool(true) {
            skipped += 1;
            continue;
        }

        let rules: IndexMap<String, ActiveRule> = config["rules"]
            .as_object()
            .expect("rules object")
            .iter()
            .filter(|(_, setting)| setting.is_object())
            .map(|(id, setting)| {
                let detector = registry
                    .get(id)
                    .unwrap_or_else(|| panic!("{}: unknown rule {id}", case.id));
                let rule = ActiveRule {
                    detector: detector.clone(),
                    setting: support::setting_from_json(setting),
                };

                (id.clone(), rule)
            })
            .collect();

        let mut context =
            (config["restore"] == Value::Bool(true)).then(|| RestorationContext::new(false));

        for group in &case.expected.groups {
            let input = &case.input;
            let span = support::to_bytes(input, &[group.start, group.end]);

            let mut matches: Vec<AppliedMatch<'_>> = group
                .matches
                .iter()
                .map(|m| {
                    let offsets = support::to_bytes(input, &[m.start, m.end]);

                    AppliedMatch {
                        detection: Detection {
                            start: offsets[0],
                            end: offsets[1],
                            rule_id: m.rule_id.clone().into(),
                            entity_type: m.entity_type.clone().into(),
                            reasons: m.reasons.iter().cloned().map(Into::into).collect(),
                        },
                        rule: &rules[&m.rule_id],
                    }
                })
                .collect();

            matches.sort_by(|a, b| {
                let (a, b) = (&a.detection, &b.detection);

                (a.start, a.end, &a.rule_id).cmp(&(b.start, b.end, &b.rule_id))
            });

            let replacement =
                resolve_replacement(input, &matches, span[0], span[1], context.as_mut());

            assert_eq!(
                replacement, group.replacement,
                "{}: group at {}",
                case.id, group.start
            );
        }

        let map = context.map(|context| context.map);
        assert_eq!(map, case.expected.map, "{}: restoration map", case.id);

        if let Some(map) = &map {
            let expected: Vec<_> = case.expected.map.iter().flatten().collect();
            assert_eq!(
                map.iter().collect::<Vec<_>>(),
                expected,
                "{}: map order",
                case.id
            );
        }

        ran += 1;
    }

    eprintln!("{file}: {ran} ran, {skipped} skipped");

    (ran, skipped)
}

#[test]
fn render_golden() {
    let (ran, _) = check_file("render.json");

    assert!(ran > 0);
}

#[test]
fn offsets_golden() {
    let (ran, _) = check_file("offsets.json");

    assert!(ran > 0);
}

#[test]
fn default_tokens() {
    assert_eq!(default_token("email"), Some("redacted@example"));
    assert_eq!(
        default_token("private_key"),
        Some("-----BEGIN REDACTED KEY-----\n-----END REDACTED KEY-----")
    );
    assert_eq!(
        default_token("datadog_api_key"),
        Some("0".repeat(40).as_str())
    );
    assert_eq!(default_token("sentry_token").map(str::len), Some(10 + 197));
    assert_eq!(default_token("no_such_type"), None);
}

#[test]
fn every_builtin_entity_type_has_a_default_token() {
    let missing: Vec<String> = support::stub_registry()
        .iter()
        .map(|detector| detector.entity_type().to_owned())
        .filter(|entity_type| default_token(entity_type).is_none())
        .collect();

    assert!(missing.is_empty(), "no default token: {missing:?}");
}

#[test]
fn token_replace_custom_and_hash_fallback() {
    let registry = support::stub_registry();
    let email = registry.get("email").expect("email").clone();

    let rule = |tokens: Option<IndexMap<String, String>>| ActiveRule {
        detector: email.clone(),
        setting: RuleSetting::TokenReplace { tokens },
    };

    let text = "x a@b.co y";
    let applied = |rule| AppliedMatch {
        detection: Detection {
            start: 2,
            end: 8,
            rule_id: "email".into(),
            entity_type: "email".into(),
            reasons: vec![],
        },
        rule,
    };

    let plain = rule(None);
    assert_eq!(
        resolve_replacement(text, &[applied(&plain)], 2, 8, None),
        "redacted@example"
    );

    let custom = rule(Some(IndexMap::from([("email".into(), "me@x".into())])));
    assert_eq!(
        resolve_replacement(text, &[applied(&custom)], 2, 8, None),
        "me@x"
    );

    let external = ActiveRule {
        detector: std::sync::Arc::new(sensored_core::detector::ExternalDetector {
            id: "custom".into(),
            entity_type: "custom_thing".into(),
            replacement: "[CUSTOM]".into(),
            stream: None,
            context_hint: None,
        }),
        setting: RuleSetting::TokenReplace { tokens: None },
    };

    // Expected value from the TS `renderTokenReplace`.
    assert_eq!(
        resolve_replacement("x secret y", &[applied(&external)], 2, 8, None),
        "[REDACTED_667C6911]"
    );
}
