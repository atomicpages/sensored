//! Per-detector golden fixtures for every ported built-in.
//!
//! Fixtures are gitignored (see `conformance/CONTEXT.md`). Generate them with
//! `bun run eval:generate` in `packages/sensored`, then
//! `bun run conformance:generate` at the repo root. Set
//! `SENSORED_DETECTORS=email,phone` to check only some detectors.

mod support;

use sensored_core::Redactor;
use sensored_core::detectors::builtins;

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

#[test]
fn ported_detectors_match_golden_fixtures() {
    let mut failures = Vec::new();
    let mut checked = 0;

    for id in selected() {
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
