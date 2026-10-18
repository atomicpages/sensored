//! Golden render fixtures through the full `Redactor`, with oracle detectors.
//!
//! Detectors are not ported yet, so each rule's detector is replaced by an
//! oracle that returns the matches the TS reference recorded for that rule.
//! This exercises policy, collection, grouping, rendering, restoration and
//! detect-only; filtered matches (allowlist, placeholders) are not recorded,
//! so their filtering is covered once real detectors land.

mod support;

use std::sync::Arc;

use sensored_core::Redactor;
use sensored_core::detector::{Detector, Input, StreamMeta};
use sensored_core::types::Detection;

struct Oracle {
    id: String,
    entity_type: String,
    replacement: String,
    stream: Option<StreamMeta>,
    matches: Vec<Detection>,
}

impl Detector for Oracle {
    fn id(&self) -> &str {
        &self.id
    }

    fn entity_type(&self) -> &str {
        &self.entity_type
    }

    fn replacement(&self) -> &str {
        &self.replacement
    }

    fn stream(&self) -> Option<StreamMeta> {
        self.stream
    }

    fn detect_in(&self, _input: &Input<'_>, out: &mut Vec<Detection>) {
        out.extend(self.matches.iter().cloned());
    }
}

/// Recorded matches in byte offsets, as `(rule id, detection)`.
fn recorded(case: &support::RenderCase) -> Vec<Detection> {
    case.expected
        .groups
        .iter()
        .flat_map(|group| &group.matches)
        .map(|m| {
            let bytes = support::to_bytes(&case.input, &[m.start, m.end]);

            Detection {
                start: bytes[0],
                end: bytes[1],
                rule_id: m.rule_id.clone(),
                entity_type: m.entity_type.clone(),
                reasons: m.reasons.clone(),
            }
        })
        .collect()
}

fn oracle_redactor(case: &support::RenderCase) -> Redactor {
    let mut registry = support::stub_registry();
    let matches = recorded(case);

    let rule_ids: Vec<String> = registry.iter().map(|d| d.id().to_owned()).collect();

    for id in rule_ids {
        let stub = registry.get(&id).expect("registered").clone();

        registry.insert(Arc::new(Oracle {
            id: id.clone(),
            entity_type: stub.entity_type().to_owned(),
            replacement: stub.replacement().to_owned(),
            stream: stub.stream(),
            matches: matches
                .iter()
                .filter(|d| d.rule_id == id)
                .cloned()
                .collect(),
        }));
    }

    Redactor::with_registry(&case.config, &registry)
        .unwrap_or_else(|e| panic!("{}: config rejected: {e:?}", case.id))
}

fn check(file: &str) {
    let cases: Vec<support::RenderCase> = support::golden(file);
    let mut failures = Vec::new();

    for case in &cases {
        let redactor = oracle_redactor(case);
        let actual = redactor
            .inspect(&case.input)
            .unwrap_or_else(|e| panic!("{}: {e:?}", case.id));

        let actual = serde_json::to_value(&actual).expect("inspection");
        let expected = support::expected_inspection(case);

        // Compared as text: `Value` equality ignores key order (map order matters).
        let (actual, expected) = (actual.to_string(), expected.to_string());

        if actual != expected {
            failures.push(format!(
                "{}\n  expected {expected}\n  actual   {actual}",
                case.id
            ));
        }

        // The hybrid seam with no caller detections must equal `inspect`.
        let collected = redactor.collect(&case.input).expect("collect");
        let rendered = redactor
            .render(&case.input, collected, true)
            .expect("render");
        let rendered = serde_json::to_value(&rendered)
            .expect("rendered")
            .to_string();

        if rendered != actual {
            failures.push(format!(
                "{}: collect + render differs from inspect()",
                case.id
            ));
        }

        // Filtering first changes nothing: `render` filters the same way.
        let collected = redactor.collect(&case.input).expect("collect");
        let filtered = redactor.filter(&case.input, collected).expect("filter");
        let rendered = redactor
            .render(&case.input, filtered, true)
            .expect("render");
        let rendered = serde_json::to_value(&rendered)
            .expect("rendered")
            .to_string();

        if rendered != actual {
            failures.push(format!(
                "{}: collect + filter + render differs from inspect()",
                case.id
            ));
        }

        let redacted = redactor.redact(&case.input).expect("redact");

        if redacted.text != case.expected.text {
            failures.push(format!("{}: redact() text differs from inspect()", case.id));
        }
    }

    assert!(
        failures.is_empty(),
        "{file}: {}/{} cases failed:\n{}",
        failures.len(),
        cases.len(),
        failures.join("\n")
    );
}

#[test]
fn render_fixtures() {
    check("render.json");
}

#[test]
fn offset_fixtures() {
    check("offsets.json");
}

#[test]
fn preset_fixtures() {
    check("presets.json");
}

#[test]
fn input_limit_errors() {
    let cases: Vec<support::ErrorCase> = support::golden("errors.json");
    let registry = support::stub_registry();
    let mut checked = 0;

    for case in cases.iter().filter(|c| c.input.is_some()) {
        let input = case.input.as_deref().expect("input");
        let error = Redactor::with_registry(&case.config, &registry)
            .and_then(|r| r.inspect(input))
            .expect_err(&case.id);

        assert_eq!(error.code.as_str(), case.expected.code, "{}", case.id);
        assert_eq!(error.path, case.expected.path, "{}", case.id);
        checked += 1;
    }

    assert!(checked > 0, "no input-dependent error cases");
}
