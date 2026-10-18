# Native engine loading

The public API (`../api.ts`) runs on the Rust core through a `NativeBinding`
(`binding.ts`): the napi addon (`@sensored/native`, `crates/sensored-napi`)
or the Wasm build (`crates/sensored-wasm`). Plan:
`docs/internal/plans/rust-core-rewrite.md`.

## Contract

- `binding.ts` is the engine contract both builds satisfy, plus
  `setBinding`/`getBinding`. Offsets are UTF-16 code units. Engine errors are
  `Error`s with the core's `code`, `path` and `info`.
- Each package entry loads one build and calls `setBinding` in its own body
  (not a side-effect-only import, which `sideEffects: false` lets bundlers
  drop). The API module never loads a build itself, so `createRedactor` stays
  synchronous:
  - `../index.ts` (Node, Bun): napi, falling back to `loadWasmSync()` when the
    addon cannot load. `SENSORED_ENGINE=wasm` forces Wasm.
  - `../index.wasm-url.ts` (browser, Deno) and `../index.wasm-module.ts`
    (Workers, Vercel Edge): Wasm, initialised with top-level await.
- `wasm-sync.ts`: `loadWasmSync()`, the synchronous Wasm loader.
- `node.ts`: `loadNodeBinding()` for `../index.ts`.

## Modules

- `redactor.ts`: `createNativeRedactor`, the body of the public
  `createRedactor`. `policy`, `describe()` come from `policyJson()` and
  `describeJson()`, deep-frozen once.
- `config.ts`: `splitConfig` runs `validateConfig` (TS order, plus what only JS
  can check: RegExps, functions, `semantic`), then builds the core's JSON:
  `semantic` dropped, definitions as descriptors, `customHeaders` strings only.
- `calls.ts`: `engineCall` rewraps engine errors as `SensoredError` (same
  `code`, `path`, `info`; JS detector errors pass through), plus the public
  `restore` and `listDetectors` over the binding.
- `custom-headers.ts`: `customHeaders` RegExps as a JS `http_auth_header`
  detector. Divergence from TS, which joins them into one pattern with the
  built-in alternatives: here they scan separately, so overlapping built-in
  and RegExp matches merge into one group instead of the leftmost winning.
  Empty captures are skipped (the core rejects empty spans).

## Hybrid seam

Rules whose detectors are JS (`DetectorDefinition`s, `Detector` subclasses)
reach the core as descriptors (metadata only). The wrapper runs them in JS and
merges their matches: `collect` + JS detections + `render` for strings,
`filter` before semantic confirmation, `pushWith`/`finishWith` for streams.
JS rules are the enabled `config.detectors` (`registerDetector`, as in TS) and
the `customHeaders` RegExps when `http_auth_header` is on.

- Fast path (no JS rules): `redact`, `redactWithMap`, `inspect`, `push` and
  `finish`, one FFI call each, whatever `semantic` says.
- Hybrid path: JS detections are appended to `collect` and sorted into policy
  order (the order TS collects in, which `redactAsync` reports).
- `redactAsync` always runs `collect` + JS, `filter`, the questions (a JS
  rule's `semanticConfirm`, else `semantic/questions.ts` by rule id), the
  provider, then `render` of the confirmed matches.
- Streams go through `../stream.ts` `createStream`. The wrapper holds back a
  trailing high surrogate until the next chunk, because the binding takes
  UTF-8 strings and would replace a split pair with U+FFFD.
