# Rust

The sensored engine is a pure-Rust crate, `sensored-core`. The npm package
wraps it; you can also use it directly from Rust.

::: warning Not yet published
`sensored-core` is not on crates.io yet. Until it is, depend on a checkout of
the repository by path.
:::

## Install

```toml
[dependencies]
sensored-core = { path = "../sensored/crates/sensored-core" }
serde_json = "1"
```

## Example

```rust
use sensored_core::stream::StreamEvent;
use sensored_core::{Redactor, SensoredError, StreamSettings, list_detectors};
use serde_json::json;

fn main() -> Result<(), SensoredError> {
    let redactor = Redactor::new(&json!({
        "presets": ["pii"],
        "rules": {},
        "restore": true
    }))?;

    // redact
    let redacted = redactor.redact("Café owner: jane@example.com")?;

    println!("{}", redacted.text);
    println!("{:?}", redacted.map);

    // inspect: offsets are UTF-8 bytes ("é" is 2 bytes)
    let inspection = redactor.inspect("Café owner: jane@example.com")?;

    for group in &inspection.groups {
        for found in &group.matches {
            println!(
                "{} at {}..{}: {}",
                found.detection.rule_id, found.detection.start, found.detection.end, found.value
            );
        }
    }

    // stream: push chunks, then finish
    let mut stream = redactor.stream(StreamSettings::default())?;
    let mut events = stream.push("Mail jane@exa")?;

    events.extend(stream.push("mple.com today.")?);
    events.extend(stream.finish());

    for event in events {
        match event {
            StreamEvent::Text(text) => print!("{text}"),
            StreamEvent::Complete(map) => println!("\n{map:?}"),
            StreamEvent::Detection(_) => {}
        }
    }

    // errors carry a code and, for config errors, a path
    let error = Redactor::new(&json!({ "rules": { "nope": { "action": "redact" } } })).unwrap_err();

    println!("{} at {:?}: {error}", error.code.as_str(), error.path);

    println!("{} built-in detectors", list_detectors().len());

    Ok(())
}
```

Output:

```text
Café owner: [EMAIL_1]
Some({"[EMAIL_1]": "jane@example.com"})
email at 13..29: jane@example.com
Mail [EMAIL_1] today.
Some({"[EMAIL_1]": "jane@example.com"})
UNKNOWN_RULE at Some("rules"): Configuration contains an unknown rule.
155 built-in detectors
```

## Configuration

`Redactor::new` takes the same config as the JS `RedactorConfig`, as a
`serde_json::Value`, minus the parts that are JavaScript: custom detectors'
`pattern`, `validate` and `semanticConfirm`, `semantic`, and RegExp
`customHeaders` (strings only). The JSON Schema is
`packages/sensored/schema/redactor-config.schema.json`. Key order follows
your JSON, as in JS.

A redactor is immutable and `Clone`; build it once and reuse it.

## API

| Item                         | Does                                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| `Redactor::new(&config)`     | Validates the config and resolves the policy                             |
| `redact(text)`               | `Redacted { text, map }`; `map` is set when `restore` is on              |
| `inspect(text)`              | `Inspection { text, groups, map }`; each group lists its matches          |
| `stream(settings)`           | A `StreamCore`: `push(chunk)` returns events, `finish()` the rest         |
| `describe()`                 | The enabled rules' detectors                                             |
| `list_detectors()`           | Every built-in detector                                                  |
| `restore::restore(text, map)`| Puts original values back                                                |

`Inspection` and `DetectorDescription` implement `Serialize`, with the same
JSON field names as JS.

## Offsets

Offsets are UTF-8 byte offsets into the `&str` you passed, so they slice it
directly (`&text[start..end]`). JS reports UTF-16 code units, so the same
match can have different offsets in the two: above, `jane@example.com` is at
13..29 in Rust and 12..28 in JS. For a stream, `StreamSettings { offsets:
OffsetUnit::Utf16, .. }` reports UTF-16 instead.

Lengths that the config sets (`limits.maxInputLength`, context windows,
`maxMatchLength`) are UTF-16 code units, as in JS, so a config behaves the same
in both.

## Errors

Every fallible call returns `Result<T, SensoredError>`. `code` is an
`ErrorCode` (`code.as_str()` gives the JS code, such as `INVALID_CONFIG`),
`path` points into the config, and `info` holds structured details. Messages
and paths never contain your input. See [Errors](./errors.md) for the codes.
