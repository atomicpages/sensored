# sensored-wasm

wasm-bindgen binding over `sensored-core` for runtimes without the napi
addon: browsers, Deno, Workers, Vercel Edge, and the Node/Bun fallback. Built
for `wasm32-unknown-unknown` and bundled in `sensored/dist/wasm/`; this crate
is not a public API. Plan: `docs/internal/plans/rust-core-rewrite.md`.

## API

The same JS API as `sensored-napi` (see its `CONTEXT.md`), so both satisfy
`NativeBinding` (`packages/sensored/src/native/binding.ts`): `Redactor.create`
and its methods, `Stream`, `restore` and `listDetectorsJson`, with the same
names, UTF-16 offsets, error shape (`Error` with `code`, `path?`, `info?`),
spent-stream error and callback semantics (`pushWith`/`finishWith` call
`detect` synchronously and rethrow what it throws as is).

Differences from napi, none visible through `NativeBinding`:

- `Redactor` and `Stream` also have `free()`. The glue frees them through a
  `FinalizationRegistry` when they are collected, so callers need not.
- Arguments of the wrong shape (e.g. a detection without `end`) throw a
  plain `Error`, as in napi, but with another message and no napi status
  `code`. Offsets are read with `ToUint32` like napi's `u32`, so `-1` is a
  `DETECTOR_CONTRACT` error in both.
- A `detect` callback that re-enters its own stream throws in both, with
  different messages.

## Modules

- `redactor.rs`: the `Redactor` class over the core `Redactor`, seam
  included.
- `stream.rs`: the `Stream` class over `StreamCore` (UTF-16 offsets from the
  core, `OffsetUnit::Utf16`).
- `js.rs`: values to and from JS via `serde-wasm-bindgen`, maps as plain
  objects in insertion order. Outgoing core values have their offsets moved
  to UTF-16 in place (`sensored_core::offsets`) and are serialized as is;
  inspections go out as JSON strings (`inspectJson`, `renderJson`), like napi. Also the TS types emitted into
  the glue's `.d.ts`.
- `error.rs`: `OrThrow` and the error shape.

## Build and test

- `bun run build:wasm` in `packages/sensored` (`scripts/build-wasm.ts`):
  `cargo build --target wasm32-unknown-unknown --release -p sensored-wasm`,
  `wasm-bindgen --target web` and `wasm-opt -O3` (skipped when missing) into
  `packages/sensored/wasm/` (gitignored). `bun run build` runs it first.
- Tools: `rustup target add wasm32-unknown-unknown`;
  `cargo install wasm-bindgen-cli --version <x>`, matching the `=` pin on
  `wasm-bindgen` in `Cargo.toml` exactly; optionally binaryen's `wasm-opt`.
  `-O3` over `-Oz`: `-Oz` saves under 2% and costs speed.
- `bun test` from this directory runs `__test__/` against napi and Wasm side
  by side (build both first): `binding.test.ts` is the napi suite run on
  each engine, and `golden.test.ts` runs `conformance/golden/` render,
  offsets, presets, errors and stream fixtures (every chunking) and requires
  Wasm output identical to napi's, key order included.
- `cargo test` from `crates/` runs the Rust unit tests (on the host).
