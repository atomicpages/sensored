//! Golden stream fixtures, for cases whose rules are all ported. Each case is
//! checked at every two-chunk split and one chunk per char, as the fixture
//! contract requires.

mod support;

use sensored_core::stream::{OffsetUnit, StreamEvent};
use sensored_core::{ErrorCode, Redactor, StreamSettings};
use serde_json::{Value, json};

/// Joined text, detection groups and final map, as JSON text.
fn run(redactor: &Redactor, settings: StreamSettings, chunks: &[&str]) -> String {
    let mut core = redactor.stream(settings).expect("stream");
    let mut events = Vec::new();

    for chunk in chunks {
        events.extend(core.push(chunk).expect("push"));
    }

    events.extend(core.finish());

    let mut text = String::new();
    let mut detections = Vec::new();
    let mut map = None;

    for event in events {
        match event {
            StreamEvent::Text(t) => text.push_str(&t),
            StreamEvent::Detection(group) => {
                detections.push(serde_json::to_value(group).expect("group"))
            }
            StreamEvent::Complete(m) => map = m,
        }
    }

    let mut out = json!({ "text": text, "detections": detections });

    if let Some(map) = map {
        out["map"] = serde_json::to_value(map).expect("map");
    }

    out.to_string()
}

#[test]
fn ported_stream_fixtures() {
    let file = support::golden_raw("stream.json");
    let cases = file["cases"].as_array().expect("cases");
    let mut ran = 0;
    let mut failures = Vec::new();

    for case in cases {
        let id = case["id"].as_str().expect("id");

        let redactor = match Redactor::new(&case["config"]) {
            Ok(redactor) => redactor,
            Err(e) if e.code == ErrorCode::UnknownRule => continue,
            Err(e) => panic!("{id}: {e:?}"),
        };

        let settings = StreamSettings {
            report: case["options"]["report"].as_bool().expect("report"),
            restore: Some(case["options"]["restore"].as_bool().expect("restore")),
            offsets: OffsetUnit::Utf16,
        };

        let input = case["input"].as_str().expect("input");
        let expected: &Value = &case["expected"];
        let expected = expected.to_string();

        let mut chunkings: Vec<Vec<&str>> = input
            .char_indices()
            .skip(1)
            .map(|(i, _)| vec![&input[..i], &input[i..]])
            .collect();

        chunkings.push(
            input
                .char_indices()
                .map(|(i, ch)| &input[i..i + ch.len_utf8()])
                .collect(),
        );

        for chunks in &chunkings {
            let actual = run(&redactor, settings, chunks);

            if actual != expected {
                failures.push(format!(
                    "{id} ({} chunks, first {:?})\n  expected {expected}\n  actual   {actual}",
                    chunks.len(),
                    chunks.first().map(|c| c.len())
                ));
                break;
            }
        }

        ran += 1;
    }

    eprintln!("stream fixtures: {ran}/{} cases ported", cases.len());

    assert!(
        failures.is_empty(),
        "{} cases failed:\n{}",
        failures.len(),
        failures.join("\n")
    );
}
