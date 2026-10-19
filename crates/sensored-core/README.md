# sensored-core

The Rust engine behind [sensored](https://github.com/atomicpages/sensored), a
streaming-first PII redaction library. It ships 155 built-in detectors (contact
details, national IDs, financial and healthcare identifiers, cloud and API
tokens, person names), five actions (redact, mask, token replace, format
preserve, remove), restorable placeholders and a streaming redactor that
holds back only as much text as a match could span.

The npm package `sensored` runs this crate through napi-rs and Wasm. The
config is the same JSON as its `RedactorConfig`, minus the JS-only parts
(RegExps, functions, `semantic`).

```rust
use sensored_core::Redactor;
use serde_json::json;

let redactor = Redactor::new(&json!({
    "rules": { "email": { "action": "redact" } },
    "restore": true,
}))?;

let redacted = redactor.redact("Contact jane@example.com")?;
assert_eq!(redacted.text, "Contact [EMAIL_1]");

let original = sensored_core::restore::restore(&redacted.text, redacted.map.as_ref().unwrap());
assert_eq!(original, "Contact jane@example.com");
# Ok::<(), sensored_core::SensoredError>(())
```

Streams take chunks and emit text as soon as no match can still cross it:

```rust
use sensored_core::{Redactor, StreamSettings, stream::StreamEvent};
use serde_json::json;

let redactor = Redactor::new(&json!({ "rules": { "phone": { "action": "redact" } } }))?;
let mut stream = redactor.stream(StreamSettings::default())?;

let mut out = String::new();
for chunk in ["Call 555-", "867-5309 today"] {
    for event in stream.push(chunk)? {
        if let StreamEvent::Text(text) = event {
            out.push_str(&text);
        }
    }
}
for event in stream.finish() {
    if let StreamEvent::Text(text) = event {
        out.push_str(&text);
    }
}
assert_eq!(out, "Call [PHONE] today");
# Ok::<(), sensored_core::SensoredError>(())
```

Offsets in results are UTF-8 byte offsets. Rules, presets, actions and
errors match the TypeScript API; see the
[documentation](https://github.com/atomicpages/sensored#readme).

License: MIT.
