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

## Wasm loaders

Each returns the glue's `{ Redactor, restore, listDetectorsJson }` as a
`NativeBinding`. The glue and binary are `wasm-bindgen --target web` output
from `bun run build:wasm` (`scripts/build-wasm.ts`) in the gitignored
`packages/sensored/wasm/`, which tsdown copies to `dist/wasm/` and keeps
external. Every loader reaches it at `../../wasm/`, which resolves from both
`src/native/` and `dist/src/native/`, so build the Wasm before tests or
typecheck that touch these files.

- `wasm-sync.ts`: `loadWasmSync()`, Node and Bun. Reads the bytes with
  `node:fs` and calls `initSync`, once; the only loader with a `node:` import.
- `wasm-url.ts`: `loadWasmUrl()`, browser and Deno. `init` fetches the
  `.wasm` by `new URL(..., import.meta.url)`.
- `wasm-module.ts`: `loadWasmModule()`, Workers and Vercel Edge. Imports the
  `.wasm` as a precompiled `WebAssembly.Module` (bundler-specific; runtimes
  such as Bun that resolve the import to something else cannot use it). Its
  type comes from the `sensored_wasm_bg.wasm.d.ts` the build script writes.

## Hybrid seam

Rules whose detectors are JS (`DetectorDefinition`s, `Detector` subclasses)
reach the core as descriptors (metadata only). The wrapper runs them in JS and
merges their matches: `collect` + JS detections + `render` for strings,
`filter` before semantic confirmation, `pushWith`/`finishWith` for streams.
With no JS rules and no semantic config, every call is one FFI call.
