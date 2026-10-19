//! Golden stream fixtures, for cases whose rules are all ported. Each case is
//! checked at every two-chunk split and one chunk per char, as the fixture
//! contract requires.

mod support;

use sensored_core::stream::{OffsetUnit, StreamEvent};
use sensored_core::types::Detection;
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

/// Every `T-` followed by digits: a stand-in for a caller's JS detector.
fn tickets(text: &str) -> Vec<Detection> {
    let mut found = Vec::new();
    let bytes = text.as_bytes();
    let mut i = 0;

    while let Some(at) = text[i..].find("T-").map(|at| at + i) {
        let end = (at + 2..=bytes.len())
            .take_while(|&e| e == at + 2 || bytes[e - 1].is_ascii_digit())
            .last()
            .unwrap_or(at + 2);

        if end > at + 2 {
            found.push(Detection {
                start: at,
                end,
                rule_id: "ticket_id".into(),
                entity_type: "ticket".into(),
                reasons: Vec::new(),
            });
        }

        i = at + 2;
    }

    found
}

/// Caller detections stream like core ones: at every split, the output equals
/// a one-shot `render`, restoration numbering included.
#[test]
fn caller_detections_stream_at_every_split() {
    let redactor = Redactor::new(&json!({
        "rules": { "ticket_id": { "action": "redact" }, "email": { "action": "redact" } },
        "detectors": [{
            "id": "ticket_id",
            "entityType": "ticket",
            "replacement": "[TICKET]",
            "stream": { "maxMatchLength": 12, "leftContext": 0, "rightContext": 0, "boundaryLookaround": 1 },
        }],
        "restore": true,
    }))
    .expect("redactor");

    let input = "😀 T-123 then a@b.co, T-123 again and T-4567.";
    let mut detections = redactor.collect(input).expect("collect");
    detections.extend(tickets(input));
    let expected = redactor.render(input, detections, false).expect("render");

    let splits = input.char_indices().map(|(i, _)| i).skip(1);

    for split in splits {
        let (head, tail) = input.split_at(split);
        let mut core = redactor.stream(StreamSettings::default()).expect("stream");
        let mut events = Vec::new();

        for chunk in [head, tail] {
            events.extend(
                core.push_with(chunk, |buffer| Ok(tickets(buffer)))
                    .expect("push"),
            );
        }

        events.extend(
            core.finish_with(|buffer| Ok(tickets(buffer)))
                .expect("finish"),
        );

        let mut text = String::new();
        let mut map = None;

        for event in events {
            match event {
                StreamEvent::Text(t) => text.push_str(&t),
                StreamEvent::Detection(_) => {}
                StreamEvent::Complete(m) => map = m,
            }
        }

        assert_eq!(text, expected.text, "split at {split}");
        assert_eq!(map, expected.map, "split at {split}");
    }
}

#[test]
fn caller_detections_must_name_a_stream_rule() {
    let redactor =
        Redactor::new(&json!({ "rules": { "email": { "action": "redact" } } })).expect("redactor");
    let mut core = redactor.stream(StreamSettings::default()).expect("stream");

    core.push("T-1").expect("push");

    let error = core
        .finish_with(|buffer| Ok(tickets(buffer)))
        .expect_err("contract");

    assert_eq!(error.code, ErrorCode::DetectorContract);
}

/// Stream metadata at `usize::MAX` saturates the holdback instead of wrapping
/// (reachable on wasm32), so nothing flushes before `finish`.
#[test]
fn huge_stream_metadata_holds_everything_back() {
    use std::sync::Arc;

    use sensored_core::detector::{ExternalDetector, StreamMeta};
    use sensored_core::stream::{StreamCore, StreamOptions};
    use sensored_core::types::{ActiveRule, RuleSetting};

    let detector = ExternalDetector {
        id: "huge".into(),
        entity_type: "huge".into(),
        replacement: "[HUGE]".into(),
        stream: Some(StreamMeta {
            max_match_length: usize::MAX,
            left_context: usize::MAX,
            right_context: usize::MAX,
            boundary_lookaround: usize::MAX,
        }),
        context_hint: None,
    };
    let rule = ActiveRule {
        detector: Arc::new(detector),
        setting: RuleSetting::FormatPreserve,
    };
    let mut core = StreamCore::new(vec![rule], StreamOptions::default()).expect("stream");

    assert!(core.push(&"x".repeat(1000)).expect("push").is_empty());
    assert!(!core.finish().is_empty());
}
