# Runtime support

sensored is designed to run anywhere JavaScript runs. The core library has zero
runtime-specific dependencies — no `node:` imports, no Bun built-ins, no
browser-only APIs.

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
