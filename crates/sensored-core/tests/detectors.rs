//! Per-detector golden fixtures for every ported built-in.
//!
//! Fixtures are gitignored (see `conformance/CONTEXT.md`). Generate them with
//! `bun run eval:generate` in `packages/sensored`, then
//! `bun run conformance:generate` at the repo root. Set
//! `SENSORED_DETECTORS=email,phone` to check only some detectors.

mod support;

use sensored_core::detectors::builtins;
use sensored_core::{ErrorCode, Redactor};

fn selected() -> Vec<String> {
    let filter = std::env::var("SENSORED_DETECTORS").ok();
    let wanted: Option<Vec<&str>> = filter.as_deref().map(|f| f.split(',').collect());

    builtins()
        .iter()
        .map(|d| d.id().to_owned())
        .filter(|id| wanted.as_ref().is_none_or(|w| w.contains(&id.as_str())))
        .collect()
}

#[test]
fn ported_detectors_match_ts_metadata() {
    let reference = support::stub_registry();

    for detector in builtins().iter() {
        let ts = reference
            .get(detector.id())
            .unwrap_or_else(|| panic!("{} is not a TS built-in", detector.id()));

        assert_eq!(
            detector.entity_type(),
            ts.entity_type(),
            "{}",
            detector.id()
        );
        assert_eq!(
            detector.replacement(),
            ts.replacement(),
            "{}",
            detector.id()
        );
        assert_eq!(detector.stream(), ts.stream(), "{}", detector.id());
    }
}

/// Built-ins whose golden fixtures do not define their behaviour.
///
/// `person_name`: the fixtures come from the TS detector, which wraps
/// `compromise`. The Rust detector is a new rule-based NER judged by quality
/// on the eval corpus (`examples/person_name_eval.rs`), not by parity.
const NOT_GOLDEN: [&str; 1] = ["person_name"];

#[test]
fn ported_detectors_match_golden_fixtures() {
    let mut failures = Vec::new();
    let mut checked = 0;

    for id in selected()
        .into_iter()
        .filter(|id| !NOT_GOLDEN.contains(&id.as_str()))
    {
        let cases: Vec<support::RenderCase> = support::golden(&format!("detectors/{id}.json"));

        for case in &cases {
            let redactor =
                Redactor::new(&case.config).unwrap_or_else(|e| panic!("{}: {e:?}", case.id));
            let actual = redactor.inspect(&case.input).expect("inspect");

            let actual = serde_json::to_value(&actual)
                .expect("inspection")
                .to_string();
            let expected = support::expected_inspection(case).to_string();

            if actual != expected {
                failures.push(format!(
                    "{id} {}\n  expected {expected}\n  actual   {actual}",
                    case.id
                ));
            }

            checked += 1;
        }
    }

    let shown: Vec<&String> = failures.iter().take(20).collect();

    assert!(
        failures.is_empty(),
        "{}/{checked} detector cases failed (first 20):\n{}",
        failures.len(),
        shown
            .iter()
            .map(|s| s.as_str())
            .collect::<Vec<_>>()
            .join("\n")
    );
}

/// The committed render fixtures (incl. `detector-edge/*`) through the real
/// detectors, for every case whose rules are all ported. These cover edge
/// cases the corpus-derived fixtures never produce.
#[test]
fn ported_detectors_match_committed_render_fixtures() {
    let mut failures = Vec::new();
    let mut ran = 0;

    for file in ["render.json", "offsets.json", "presets.json"] {
        let cases: Vec<support::RenderCase> = support::golden(file);

        for case in &cases {
            let redactor = match Redactor::new(&case.config) {
                Ok(redactor) => redactor,
                Err(e) if e.code == ErrorCode::UnknownRule => continue,
                Err(e) => panic!("{}: {e:?}", case.id),
            };

            let actual = redactor.inspect(&case.input).expect("inspect");
            let actual = serde_json::to_value(&actual)
                .expect("inspection")
                .to_string();
            let expected = support::expected_inspection(case).to_string();

            if actual != expected {
                failures.push(format!(
                    "{file} {}\n  expected {expected}\n  actual   {actual}",
                    case.id
                ));
            }

            ran += 1;
        }
    }

    eprintln!("committed render fixtures through real detectors: {ran}");

    assert!(
        failures.is_empty(),
        "{} cases failed:\n{}",
        failures.len(),
        failures.join("\n")
    );
}
