# sensored-core

Pure-Rust redaction engine, no FFI. The napi and Wasm bindings wrap it.
Not yet on crates.io (see Publishing). Plan: `docs/internal/plans/rust-core-rewrite.md`.
The TS engine in `packages/sensored/src/` is the reference; the golden fixtures
in `conformance/golden/` define parity.

## Units

Offsets are UTF-8 byte offsets. Every window, limit and stream bound that TS
measures in UTF-16 code units stays in UTF-16 units here (`text.rs`:
`window_before`, `window_after`, `utf16_len`). Bindings convert offsets once
per call (`utf8_to_utf16`, `utf16_to_utf8`).

## Modules

- `types.rs`, `errors.rs`: shared types and error codes (contract).
  `Detection` labels are `Label` (`Cow<'static, str>`): built-ins borrow
  static ids and reasons, so a detection allocates only its `reasons` list.
  Reasons derived from an id at runtime (`<id>.format`) go through
  `detector::intern`, once per `detect_in` call.
- `text.rs`: UTF-16 measurement and offset conversion.
- `grapheme.rs`: grapheme boundaries via `unicode-segmentation`. Keeps the TS
  quirk that a position between two ASCII bytes is a boundary.
- `detector.rs`: the `Detector` trait (implement `detect_in(&Input, out)`;
  `detect(text, out)` wraps it), `Input` (one call's text, shared by every
  detector, with a lazy ASCII-lowercased copy), `StreamMeta`, adjacency and
  grapheme filters, `ContextMatcher` (with `ContextScan`: label occurrences
  are found once per text, exact window regexes run only where a label
  overlaps the window, and a text with no label skips the pattern scan;
  detectors with required context should use it). The label pre-check runs
  lowercase literals on `Input::ascii_lower` instead of `(?i)`, which keeps
  the regex crate's literal prefilter (15x faster on labels); results are
  identical, and texts with K or ſ fall back to `(?i)`. Also the
  table-driven `ContextDetector`, `ChecksumDetector` and `KeywordDetector`. `ExternalDetector` carries the
  metadata of a caller's JS detector; its matches arrive via collect/render.
- `checksum.rs`: Luhn and NPI.
- `detectors/`: the `Registry` and one module per family (`contact/`,
  `national_id/`, ...). Each family's `mod.rs` exposes `register`;
  `builtins()` wires every family in once and caches the result. A detector
  port touches only its family's directory. `detectors/mod.rs` also holds the
  helpers families share: `regex()` (compile static patterns),
  `has_ascii_digit()` (TS `/\d/.test`) and `#[cfg(test)] test_support`
  (`detect`, `spans`, `values`); families import them with `use super::...`
  and keep only family-specific helpers locally.
- `policy.rs`: `resolve_policy`, ported check for check from `policy.ts`, so
  every error has the TS code and path. Children: `validate.rs` (config shape,
  rule settings, limits), `presets.rs` (built-in preset table, all `redact`;
  `name@N` refs; merge conflicts unless the rule is in `config.rules`),
  `descriptor.rs` (external detector descriptors), `json.rs` (JS semantics:
  safe integers, `null` counts as defined, `Object.entries` key order).
  - The config is JSON only. `semantic` is TS-only: the TS wrapper strips it,
    so here it is an unknown key (`INVALID_CONFIG` at `rules`).
  - `detectors` holds descriptors `{ id, entityType, replacement, context?,
    stream?, contextHint? }`. The wrapper strips and checks `pattern`,
    `validate` and `semanticConfirm`; here they are unknown keys. Each
    descriptor becomes an `ExternalDetector` on a copy of the registry.
  - `customHeaders` are validated (strings only) and replace
    `http_auth_header` with `token::http_auth_header::with_custom_headers`.
  - Key order follows the caller's JSON, as in TS; `serde_json` is built
    with `preserve_order` for this.
- `render/`: `resolve_replacement` picks the winning action (remove > redact
  > format-preserve > token-replace > mask; highest redact priority) in
  `mod.rs`, which also issues numbered restoration placeholders. One private
  submodule per action renders it; mask and format-preserve count grapheme
  clusters, so byte offsets give the same output as TS's UTF-16 offsets.
- `token_generators.rs`: static default token per entity type.
- `hash.rs`: FNV-1a over UTF-16 code units, as TS hashes `charCodeAt`.
- `restore.rs`, `stream_restore.rs`: placeholder restoration.
- `offsets.rs`: `OffsetMap` and `inspection_to_utf16`, for bindings whose
  callers count UTF-16 (napi, Wasm).
- `engine.rs`: collect, filter (placeholders, allowlist), hold the flush back
  from every detected span, group overlaps, render. `render_detected` is the
  hybrid seam: core plus caller detections in, rendered segments out.
- `stream.rs`: `StreamCore` (sync push/finish; `push_with`/`finish_with`
  take a callback for caller detections in the buffer). Flush math, buffer limit and
  trimming in UTF-16 units; reported offsets in the caller's `OffsetUnit`.
- `redactor.rs`: `Redactor` (new, inspect, redact, stream, policy, describe)
  and the seam (`collect`, `filter`, `render`); `list_detectors()` lists the
  built-ins in the TS `listDetectors()` order (family order in `builtins()`,
  then each family's `register` order).

## Regex porting

JS `\d`, `\w` and `\b` are ASCII even with the `u` flag; the `regex` crate's are
Unicode. Port them as `[0-9]`, `[A-Za-z0-9_]` and `(?-u:\b)`. JS `\s` also
matches U+FEFF and not U+0085: use `text::JS_SPACE_CLASS` in patterns and
`text::is_js_space` in code. JS `i` without `u` folds ASCII only, so spell
out `[A-Za-z]` (or `(?i-u:...)`) instead of `(?i)`. The `regex` crate has no
lookaround; replace it with code.

## Tests

`tests/support/` loads golden fixtures and builds `stub_registry()`: every TS
built-in's metadata (`conformance/golden/builtins.json`, exported from the TS
registry) as detectors that find nothing, so policy and rendering are tested
against recorded matches before detectors are ported. Run `cargo test` from
`crates/`.

- `tests/engine.rs`: render fixtures through `Redactor` with oracle detectors.
- `tests/detectors.rs`: every ported built-in against
  `conformance/golden/detectors/<id>.json` (gitignored; run
  `bun run eval:generate` in `packages/sensored`, then
  `bun run conformance:generate`), plus metadata parity with TS.
  `SENSORED_DETECTORS=email,phone` narrows the run. Also runs the committed
  `render.json`, `offsets.json` and `presets.json` cases (incl.
  `detector-edge/*`) through the real detectors once all their rules are
  ported. `list_detectors_matches_ts` checks `list_detectors()` against
  `builtins.json`, order and context hints included. `person_name` is excluded from its golden fixtures (`NOT_GOLDEN`):
  TS wraps `compromise`, while the Rust detector is a rule-based NER judged
  by quality, not parity.
- `tests/stream.rs`: stream fixtures whose rules are all ported, at every
  two-chunk split and one chunk per char.
- `examples/detector_profile.rs`: per-detector time on a text file
  (`cargo run --release --example detector_profile -- <file>`).
- `examples/person_name_eval.rs`: scores `person_name` on the eval corpus
  (official labels and true names only; results in
  `packages/sensored/eval/person-name-baseline.json`).

## Publishing

Not yet published. `release.yml` publishes it to crates.io as `sensored-core`
when its opt-in `crate` input is set (see `.github/RELEASING.md`). `Cargo.toml` `include` ships `src/` (with
`person/bloom.bin`) and `README.md` only: tests and examples read
`conformance/` and the eval corpus outside the crate, so `cargo package`
warns that it ignores them. Check with `cargo package -p sensored-core --list`.
The bindings are `publish = false`.
