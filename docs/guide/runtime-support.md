# Runtime support

sensored is designed to run anywhere JavaScript runs. The engine is Rust: a
native addon where one exists for the platform, a WebAssembly build
everywhere else. Each runtime gets the right one through the package's export
conditions, with the same API and the same output.

## Engines

| Runtime                         | Engine                       | Entry (`exports["."]`) |
| ------------------------------- | ---------------------------- | ---------------------- |
| Node.js 20+, Bun                | Native (napi), Wasm fallback | `default`              |
| Deno                            | Wasm, loaded by URL          | `deno`                 |
| Browser                         | Wasm, loaded by URL          | `browser`              |
| Cloudflare Workers, Vercel Edge | Wasm, imported as a module   | `worker`, `edge-light` |

- Node and Bun load Wasm synchronously when the native addon for the platform
  is missing or fails to load. `SENSORED_ENGINE=wasm` forces it.
- Deno loads Wasm rather than the native addon, which would need
  `--allow-ffi`.
- The Wasm entries load the engine with top-level await, so `createRedactor`
  stays synchronous. Your runtime or bundler must support top-level await in
  ES modules (every current browser, Deno, Workers, Vite, esbuild with an
  `esnext` or `es2022` target, webpack 5).
- Workers and Vercel Edge compile `.wasm` imports at deploy time. Wrangler
  handles the import as is; on Vercel Edge and other bundlers you may need a
  Wasm plugin.
- The Wasm binary (`dist/wasm/sensored_wasm_bg.wasm`) is 1.7 MB, 0.73 MB
  gzipped. It redacts about a third as fast as the native addon.

## Supported runtimes

| Runtime            | Supported | CI tested             |
| ------------------ | --------- | --------------------- |
| Node.js 20+        | Yes       | Yes (smoke test)      |
| Bun                | Yes       | Yes (full test suite) |
| Deno               | Yes       | Yes (smoke test)      |
| Browser            | Yes       | Yes (static analysis) |
| Cloudflare Workers | Yes       | Yes (static analysis) |
| Vercel Edge        | Yes       | Yes (static analysis) |

## Importing

### Node.js / Bun

```ts
import { createRedactor } from "sensored";
```

### Deno

```ts
import { createRedactor } from "npm:sensored";
```

### Browser / Edge

```ts
import { createRedactor } from "sensored";
```

Bundlers (Vite, webpack, esbuild) will pick up the ESM build automatically.

## What works everywhere

- `createRedactor()` — synchronous redaction
- `redactValue()` — recursive object traversal
- `redactor.stream()` — streaming redaction
- `restore()` — placeholder restoration
- All 131 built-in detectors
- All 10 presets
- Custom detectors
- Allowlist
- `detectOnly` mode

## Runtime-specific notes

### person_name detector

The `person_name` NER runs in the engine and needs no extra dependency.
`preloadPersonNameDetector()` is kept for compatibility and resolves
immediately.

### Semantic confirmation

The `semantic` feature uses `@typesafe-ai/sdk` (optional peer dependency). It
requires network access to the TypeSafe API and works in all runtimes that
support `fetch()`.

### CLI

The `sensored` CLI is Bun-only. The core library and all adapters work in any
runtime.

## CI verification

The `runtime-smoke.yml` workflow runs on every push and pull request:

1. **Build** — builds `dist/` with Bun
2. **Node.js** — imports `dist/src/index.mjs` in Node.js 20 and verifies
   redaction works
3. **Deno** — imports `dist/src/index.mjs` in Deno and verifies redaction works
4. **Edge/Browser** — scans `dist/src/` for `node:` imports to verify
   browser/edge compatibility
