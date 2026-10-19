mod support;

use std::collections::HashSet;

use sensored_core::detector::{HintPosition, StreamMeta};
use sensored_core::policy::{MAX_INPUT_LENGTH, ResolvedPolicy, resolve_policy};
use sensored_core::{ErrorCode, Result};
use serde_json::{Value, json};

/// Error cases that exercise TS-only config, which the TS wrapper strips or
/// checks before the config reaches Rust.
const TS_ONLY_ERROR_CASES: &[&str] = &[
    // `semantic` is TS-only; Rust rejects the key as unknown (at `rules`).
    "invalid-config/semantic/empty",
];

fn resolve(config: &Value) -> Result<ResolvedPolicy> {
    resolve_policy(config, &support::stub_registry())
}

fn error_of(config: &Value) -> (ErrorCode, Option<String>) {
    let error = resolve(config).expect_err("config is rejected");

    (error.code, error.path)
}

// ---------------------------------------------------------------------------
// Golden fixtures
// ---------------------------------------------------------------------------

#[test]
fn golden_policies() {
    for case in support::golden::<support::PolicyCase>("policy.json") {
        let resolved = resolve(&case.config).unwrap_or_else(|e| panic!("{}: {e:?}", case.id));
        let policy = serde_json::to_value(&resolved.policy).expect("policy serializes");

        // Compared as text: `Value` equality ignores key order, TS order matters.
        assert_eq!(
            policy.to_string(),
            case.expected.policy.to_string(),
            "{}",
            case.id
        );
        assert_eq!(resolved.rules.len(), resolved.policy.len(), "{}", case.id);
    }
}

#[test]
fn golden_errors() {
    let cases = support::golden::<support::ErrorCase>("errors.json");

    for case in &cases {
        if case.input.is_some() || TS_ONLY_ERROR_CASES.contains(&case.id.as_str()) {
            continue;
        }

        let (code, path) = error_of(&case.config);

        assert_eq!(code.as_str(), case.expected.code, "{}", case.id);
        assert_eq!(path, case.expected.path, "{}", case.id);
    }

    for id in TS_ONLY_ERROR_CASES {
        assert!(cases.iter().any(|case| case.id == *id), "stale skip: {id}");
    }
}

#[test]
fn golden_render_configs_resolve() {
    for file in ["presets.json", "render.json", "offsets.json"] {
        for case in support::golden::<support::RenderCase>(file) {
            let resolved = resolve(&case.config).unwrap_or_else(|e| panic!("{}: {e:?}", case.id));

            for group in &case.expected.groups {
                for found in &group.matches {
                    assert!(
                        resolved.policy.contains_key(&found.rule_id),
                        "{file} {}: {} not in policy",
                        case.id,
                        found.rule_id,
                    );
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Settings beyond the policy map
// ---------------------------------------------------------------------------

#[test]
fn defaults() {
    let resolved = resolve(&json!({ "rules": { "email": { "action": "redact" } } })).unwrap();

    assert_eq!(resolved.max_input_length, MAX_INPUT_LENGTH);
    assert!(!resolved.restore);
    assert!(!resolved.detect_only);
    assert!(resolved.allowlist.is_empty());
}

#[test]
fn top_level_options() {
    let resolved = resolve(&json!({
        "rules": { "email": { "action": "redact" } },
        "limits": { "maxInputLength": 64 },
        "restore": true,
        "allowlist": ["a", "b", "a"],
    }))
    .unwrap();

    assert_eq!(resolved.max_input_length, 64);
    assert!(resolved.restore);
    assert_eq!(resolved.allowlist, HashSet::from(["a".into(), "b".into()]));

    let detect_only = resolve(&json!({
        "rules": { "email": { "action": "redact" } },
        "detectOnly": true,
    }))
    .unwrap();

    assert!(detect_only.detect_only);
}

#[test]
fn custom_headers_are_accepted() {
    let config = json!({
        "rules": { "http_auth_header": { "action": "redact" } },
        "detectorOptions": { "http_auth_header": { "customHeaders": ["X-Example-Auth"] } },
    });

    assert!(resolve(&config).is_ok());
}

#[test]
fn ts_only_semantic_key_is_rejected() {
    let config = json!({ "rules": { "email": { "action": "redact" } }, "semantic": {} });

    assert_eq!(
        error_of(&config),
        (ErrorCode::InvalidConfig, Some("rules".into()))
    );
}

#[test]
fn active_rules_follow_policy_order() {
    let resolved = resolve(&json!({
        "presets": ["pci-dss"],
        "rules": { "email": { "action": "remove" } },
    }))
    .unwrap();

    let ids: Vec<&str> = resolved
        .rules
        .iter()
        .map(|rule| rule.detector.id())
        .collect();
    let keys: Vec<&str> = resolved.policy.keys().map(String::as_str).collect();

    assert_eq!(ids, keys);
    assert_eq!(ids.first(), Some(&"payment_card"));
    assert_eq!(ids.last(), Some(&"email"));
}

#[test]
fn version_errors_carry_available_versions() {
    let error = resolve(&json!({ "presets": ["pii@2"], "rules": {} })).unwrap_err();

    assert_eq!(
        error.info,
        Some(json!({ "preset": "pii", "availableVersions": [1] }))
    );
}

// ---------------------------------------------------------------------------
// External detector descriptors
// ---------------------------------------------------------------------------

fn with_detectors(detectors: Value) -> Value {
    json!({ "rules": { "ticket_id": { "action": "redact" } }, "detectors": detectors })
}

fn descriptor() -> Value {
    json!({ "id": "ticket_id", "entityType": "ticket", "replacement": "[TICKET]" })
}

fn descriptor_with(key: &str, value: Value) -> Value {
    let mut descriptor = descriptor();
    descriptor[key] = value;

    descriptor
}

fn descriptor_error(descriptor: Value) -> (ErrorCode, Option<String>) {
    error_of(&with_detectors(json!([descriptor])))
}

fn invalid_at(path: &str) -> (ErrorCode, Option<String>) {
    (ErrorCode::InvalidConfig, Some(path.into()))
}

#[test]
fn descriptor_registers_an_external_detector() {
    let mut full = descriptor();
    full["context"] = json!({ "before": 10, "after": 5 });
    full["stream"] = json!({
        "maxMatchLength": 12,
        "leftContext": 10,
        "rightContext": 5,
        "boundaryLookaround": 1,
    });
    full["contextHint"] = json!({ "labels": ["Ticket"], "position": "preceding" });

    let resolved = resolve(&with_detectors(json!([full]))).unwrap();
    let detector = &resolved.rules[0].detector;

    assert_eq!(detector.id(), "ticket_id");
    assert_eq!(detector.entity_type(), "ticket");
    assert_eq!(detector.replacement(), "[TICKET]");
    assert_eq!(detector.stream(), Some(StreamMeta::new(12, 10, 5)));

    let hint = detector.context_hint().expect("context hint");

    assert!(hint.required);
    assert_eq!(hint.labels, ["Ticket"]);
    assert_eq!(hint.position, HintPosition::Preceding);
    assert_eq!((hint.window.before, hint.window.after), (10, 5));
    assert_eq!(hint.instructions, None);
}

#[test]
fn minimal_descriptor_has_no_stream_or_hint() {
    let resolved = resolve(&with_detectors(json!([descriptor()]))).unwrap();
    let detector = &resolved.rules[0].detector;

    assert_eq!(detector.stream(), None);
    assert!(detector.context_hint().is_none());
}

#[test]
fn hint_defaults() {
    let resolved = resolve(&with_detectors(json!([descriptor_with(
        "contextHint",
        json!({})
    )])))
    .unwrap();
    let hint = resolved.rules[0].detector.context_hint().unwrap();

    assert!(hint.labels.is_empty());
    assert_eq!(hint.position, HintPosition::Both);
    assert_eq!((hint.window.before, hint.window.after), (0, 0));
}

#[test]
fn descriptor_requires_identity_fields() {
    for key in ["id", "entityType", "replacement"] {
        let mut missing = descriptor();
        missing.as_object_mut().unwrap().remove(key);

        assert_eq!(descriptor_error(missing), invalid_at("detectors"), "{key}");
    }

    assert_eq!(
        descriptor_error(descriptor_with("id", json!("Ticket"))),
        invalid_at("detectors")
    );
    assert_eq!(
        descriptor_error(descriptor_with("entityType", json!(""))),
        invalid_at("detectors")
    );
}

#[test]
fn descriptor_rejects_ts_only_and_unknown_keys() {
    for key in ["pattern", "validate", "semanticConfirm", "extra"] {
        assert_eq!(
            descriptor_error(descriptor_with(key, json!("x"))),
            invalid_at("detectors"),
            "{key}"
        );
    }
}

#[test]
fn descriptor_nested_shapes() {
    let context = json!({ "before": 10, "after": 0 });
    let stream = json!({
        "maxMatchLength": 4,
        "leftContext": 5,
        "rightContext": 0,
        "boundaryLookaround": 1,
    });

    let mut too_narrow = descriptor_with("context", context);
    too_narrow["stream"] = stream.clone();

    assert_eq!(descriptor_error(too_narrow), invalid_at("detectors.stream"));

    let mut zero_length = stream.clone();
    zero_length["maxMatchLength"] = json!(0);

    assert_eq!(
        descriptor_error(descriptor_with("stream", zero_length)),
        invalid_at("detectors.stream")
    );
    assert_eq!(
        descriptor_error(descriptor_with(
            "context",
            json!({ "before": -1, "after": 0 })
        )),
        invalid_at("detectors.context")
    );
    assert_eq!(
        descriptor_error(descriptor_with("contextHint", json!({ "labels": [] }))),
        invalid_at("detectors.contextHint")
    );
    assert_eq!(
        descriptor_error(descriptor_with(
            "contextHint",
            json!({ "position": "around" })
        )),
        invalid_at("detectors.contextHint")
    );
}

#[test]
fn descriptor_ids_must_be_new() {
    let builtin = descriptor_with("id", json!("email"));

    assert_eq!(descriptor_error(builtin), invalid_at("detectors"));
    assert_eq!(
        error_of(&with_detectors(json!([descriptor(), descriptor()]))),
        invalid_at("detectors")
    );
}

#[test]
fn descriptor_id_is_unknown_without_registration() {
    let config = json!({ "rules": { "ticket_id": { "action": "redact" } } });

    assert_eq!(
        error_of(&config),
        (ErrorCode::UnknownRule, Some("rules".into()))
    );
}
