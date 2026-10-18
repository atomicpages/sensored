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

## Hybrid seam

Rules whose detectors are JS (`DetectorDefinition`s, `Detector` subclasses)
reach the core as descriptors (metadata only). The wrapper runs them in JS and
merges their matches: `collect` + JS detections + `render` for strings,
`filter` before semantic confirmation, `pushWith`/`finishWith` for streams.
With no JS rules and no semantic config, every call is one FFI call.
