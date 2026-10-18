# sensored-napi

napi-rs binding over `sensored-core` for Node and Bun, published (phase 5) as
`@sensored/native-<platform>`. The TS loader in `packages/sensored/src/native/`
(phase 4) wraps it; this crate is not a public API. Plan:
`docs/internal/plans/rust-core-rewrite.md`.

## Units

Every offset crossing the boundary is a UTF-16 code unit, as the JS
`Detection` type reports. The core works in UTF-8 bytes; `offsets.rs`
(`OffsetMap`) sorts a call's offsets, converts them in one pass with
`sensored_core::text::{utf8_to_utf16, utf16_to_utf8}` and skips the walk for
ASCII text. Streams need no conversion: the core reports
`OffsetUnit::Utf16` itself.

## API (`index.d.ts`)

- `Redactor.create(configJson: string): Redactor`. The config is the
  JSON-only `RedactorConfig`; JS detectors arrive as descriptors in
  `detectors`.
- Fast path, one FFI call each: `redact(text): string`,
  `redactWithMap(text): { text, map? }`, `inspect(text): Inspection` (same
  shape as TS, plus `map` when `restore` is on), `policyJson(): string`.
- Hybrid seam: `collect(text): Detection[]` returns raw core detections
  (no allowlist or placeholder filtering). `render(text, detections, report):
  Inspection` filters, groups and renders core plus JS detections; `groups` is
  empty unless `report`. A rule id outside the enabled rules, an offset out
  of bounds or inside a surrogate pair, or `start >= end` throws
  `DETECTOR_CONTRACT`. `filter(text, detections): Detection[]` drops what
  `render` would (matches inside existing placeholders, allowlisted values)
  with the same checks, for callers that act on matches before rendering
  (`redactAsync`'s semantic confirmation).
- `describeJson(): string`: the enabled rules' `DetectorDescription`s in
  policy order; `listDetectorsJson(): string`, a free function, every
  built-in in `listDetectors()` order. JSON, like `policyJson`: both are cold
  paths.
- `stream(report, restore?): Stream` with `push(chunk)` and `finish()`, each
  returning `{ type: "text", text }`, `{ type: "detection", group }` or
  `{ type: "complete", map? }` events. `finish` consumes the stream: later
  `push`/`finish` calls throw a plain `Error("Stream is already finished.")`
  with no core `code`. Hybrid seam: `pushWith(chunk, detect)` and
  `finishWith(detect)` call `detect(buffer): Detection[]` synchronously
  whenever text may flush; its detections (UTF-16 offsets into the buffer)
  render with the core's, under one restoration map. What `detect` throws is
  rethrown as is.
- `restore(text, map): string`, a free function.

## Errors

A core `SensoredError` is thrown as a JS `Error`:

```ts
{
  message: string; // the code's safe message, never caller values
  code: string;    // e.g. "INVALID_CONFIG", "DETECTOR_CONTRACT"
  path?: string;   // e.g. "detectors.stream"
  info?: unknown;  // e.g. { preset: "pii", availableVersions: [1] }
}
```

Malformed config JSON is `INVALID_CONFIG` with no path. The TS loader rewraps
these as `SensoredError`.

## Modules

- `redactor.rs`: the `Redactor` class over the core `Redactor`, including
  the seam (`collect`/`render` live in the core so Wasm shares them).
- `stream.rs`: the `Stream` class over `StreamCore`.
- `js.rs`: JS object types and moves from core types.
- `error.rs`: `OrThrow` and the error shape above.

## Build and test

Run these from this directory, with bun:

- `bun install`, then `bun run build` (release) or `bun run build:debug`.
  Either one writes `sensored.<platform>.node`, `index.js` and `index.d.ts`.
- `bun test` runs `__test__/binding.test.ts` against the built addon.
- `cargo test` from `crates/` runs the Rust unit tests.

Committed: `index.d.ts` (the generated API contract, so API changes show up in
review) and `bun.lock`. Ignored: `*.node` (platform binaries) and `index.js`
(the generated platform loader, rebuilt on every build). The package is
private and a root Bun workspace, so `packages/sensored` resolves
`@sensored/native` (`workspace:*`). `package.json` lists the 7 plan
targets; local builds are darwin-arm64 only.
