# sensored-core

Pure-Rust redaction engine, no FFI. The napi and Wasm bindings wrap it, and it
is published to crates.io. Plan: `docs/internal/plans/rust-core-rewrite.md`.
The TS engine in `packages/sensored/src/` is the reference; the golden fixtures
in `conformance/golden/` define parity.

## Units

Offsets are UTF-8 byte offsets. Every window, limit and stream bound that TS
measures in UTF-16 code units stays in UTF-16 units here (`text.rs`:
`window_before`, `window_after`, `utf16_len`). Bindings convert offsets once
per call (`utf8_to_utf16`, `utf16_to_utf8`).

## Modules

- `types.rs`, `errors.rs`: shared types and error codes (contract).
- `text.rs`: UTF-16 measurement and offset conversion.
- `grapheme.rs`: grapheme boundaries via `unicode-segmentation`. Keeps the TS
  quirk that a position between two ASCII bytes is a boundary.
- `detector.rs`: the `Detector` trait, `StreamMeta`, adjacency and grapheme
  filters, `ContextMatcher`, and the table-driven `ContextDetector`,
  `ChecksumDetector` and `KeywordDetector`. `ExternalDetector` carries the
  metadata of a caller's JS detector; its matches arrive via collect/render.
- `checksum.rs`: Luhn and NPI.
- `detectors/`: the `Registry`. Each family module exposes `register`;
  `builtins()` wires the families in.
- `policy.rs`: config validation and policy resolution (presets, overrides,
  external detector descriptors).
- `render/`: `resolve_replacement` picks the winning action (remove > redact
  > format-preserve > token-replace > mask; highest redact priority) in
  `mod.rs`, which also issues numbered restoration placeholders. One private
  submodule per action renders it; mask and format-preserve count grapheme
  clusters, so byte offsets give the same output as TS's UTF-16 offsets.
- `token_generators.rs`: static default token per entity type.
- `hash.rs`: FNV-1a over UTF-16 code units, as TS hashes `charCodeAt`.
- `restore.rs`, `stream_restore.rs`: placeholder restoration.

## Regex porting

JS `\d`, `\w` and `\b` are ASCII even with the `u` flag; the `regex` crate's are
Unicode. Port them as `[0-9]`, `[A-Za-z0-9_]` and `(?-u:\b)`. JS `\s` also
matches U+FEFF. The `regex` crate has no lookaround; replace it with code.

## Tests

`tests/support/` loads golden fixtures and builds `stub_registry()`: every TS
built-in's metadata (`tests/data/detectors.json`, exported from the TS
registry) as detectors that find nothing, so policy and rendering are tested
against recorded matches before detectors are ported. Run `cargo test` from
`crates/`.
