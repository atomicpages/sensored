# Migrating to v2

sensored 2.0 replaces the TypeScript engine with a Rust core. The public API
is unchanged: the same exports, the same types, and `createRedactor` is still
synchronous. The major version reflects behavior changes, listed below.

## Upgrade

```bash
bun add sensored@2
# or
npm install sensored@2
```

If you installed `compromise` only for `person_name`, remove it:

```bash
bun remove compromise
```

## Engine

| Runtime                         | Engine                              |
| ------------------------------- | ----------------------------------- |
| Node.js 20+, Bun                | Native addon (napi), Wasm fallback  |
| Deno                            | Wasm                                |
| Browser                         | Wasm                                |
| Cloudflare Workers, Vercel Edge | Wasm                                |

- The native addon ships for 7 platforms (macOS arm64/x64, Linux
  x64/arm64 glibc and musl, Windows x64) as optional dependencies:
  `@sensored/native` plus one `@sensored/native-<platform>` package per
  platform. Your package manager installs only the one for your platform.
  Installs that skip optional dependencies (`--no-optional`,
  `--omit=optional`) fall back to Wasm.
- On Node.js and Bun, `SENSORED_ENGINE=wasm` forces the Wasm build.
- The browser entry loads Wasm with top-level await, so it needs a bundler
  that supports it (Vite, webpack 5, esbuild with an `es2022` or `esnext`
  target).
- Browser bundles grow by the Wasm binary: about 1.7 MB raw, 0.75 MB gzipped.
  See [Runtime Support](./runtime-support.md) for the measured size.

## person_name

`person_name` is now a rule-based detector in the engine, not
[compromise](https://github.com/spencermountain/compromise). It needs no
extra dependency, and `preloadPersonNameDetector()` is a no-op kept for
compatibility.

Before:

```ts
import { createRedactor, preloadPersonNameDetector } from "sensored";

await preloadPersonNameDetector(); // loads compromise

const redactor = createRedactor({
  rules: { person_name: { action: "redact" } },
});

redactor.redact("The meeting was chaired by Dr. Sarah Johnson.");
// "The meeting was chaired by [PERSON_NAME]."
```

After:

```ts
import { createRedactor } from "sensored";

const redactor = createRedactor({
  rules: { person_name: { action: "redact" } },
});

redactor.redact("The meeting was chaired by Dr. Sarah Johnson.");
// "The meeting was chaired by Dr. [PERSON_NAME]."
```

Matches differ from compromise's:

- Honorifics stay outside the match: `Dr. [PERSON_NAME]`.
- Missed: all-caps names (`JOHN SMITH`), a lone first name without an
  honorific (`Ask Sarah`), and names that start with initials
  (`J. R. Tolkien`).
- Names in non-Latin scripts are not matched.
- Company and place names made of surnames may match.

`person_name_lite`, the detector the presets use, is unchanged.

## Unicode input

The engine works on UTF-8 strings, so a lone (unpaired) surrogate in the input
comes back as U+FFFD (`�`). Valid surrogate pairs are unaffected, including
pairs split across stream chunks.

## customHeaders

`http_auth_header`'s `customHeaders` accepts the same strings and RegExps. A
RegExp is matched case-insensitively by its `source` (its own flags are
ignored), and its first capture group that matched is redacted. Where it
overlaps a built-in header match, both are redacted as one span. See
[Tokens & Keys](../detectors/token.md).

## Input limits

Unchanged: `createRedactor` enforces `limits.maxInputLength` (default
1,048,576 UTF-16 code units). Sessions and the LLM adapters still have no
input limit by default, and honor `limits.maxInputLength` when you set it.

## Performance

The native engine against the 1.x TypeScript engine, all detectors,
`redact()`:

| Input           | Speedup |
| --------------- | ------- |
| Chat, ASCII     | 3.7x    |
| Chat, Unicode   | 4.4x    |
| 1 MiB, ASCII    | 3.8x    |
| 1 MiB, Unicode  | 21x     |

p99 latency is far lower on every input. The Wasm build is currently slower
than the 1.x engine on short texts.

## Rust

The engine is also a Rust crate, `sensored-core`. See [Rust](./rust.md).
