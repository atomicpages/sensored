# sensored

Portable deterministic text-redaction library, developed and tested with Bun.
The runtime engine is the Rust core (`crates/sensored-core`), loaded through
the napi addon or Wasm. `packages/sensored/src/` is the TypeScript API over it
and the frozen TS reference engine (`reference.ts`).

## Sources of truth

- packages/sensored/src/CONTEXT.md: architecture and module boundaries.

Coverage includes email, payment cards, national IDs, healthcare identifiers,
financial references, crypto addresses, VIN/IMEI/IMSI, tracking numbers, and
more. All built-in and trusted custom detectors share one contract. Published
code uses standard APIs; Bun-specific APIs belong in development tooling only.
This library has no HTTP server or database component.

`packages/sensored/src/index.ts` loads the engine and exports the API
(`api.ts`); `native/` holds the engine seam. `crates/sensored-core` owns
policy resolution, detection, overlap resolution and rendering;
`conformance/golden/` pins it to the TS reference. `packages/sensored/test/` contains
Bun regression tests. Each meaningful logic directory has a CONTEXT.md.

## Monorepo structure

This is a Bun workspace monorepo:

- `packages/sensored/` — the `sensored` npm package (MIT)
- `packages/enterprise/` — the `@sensored/enterprise` npm package (commercial EULA)
- `example/` — usage examples (not published)
- `docs/` — VitePress documentation site

The root `package.json` is private and orchestrates the workspace. Shared
devDependencies live at the root. Each package has its own `tsconfig.json`
extending `tsconfig.base.json` at the root.

The package is published as `sensored` on npm, with `@sensored/native` and its
`@sensored/native-<platform>` addons (`crates/sensored-napi`). Versioning
uses changesets; `.github/workflows/release.yml` builds the 7 native targets
and publishes (procedure: `.github/RELEASING.md`). Conventional commits are enforced by commitlint
(`commitlint.config.ts`) via a `.husky/commit-msg` hook. Interactive commit
prompts are available via `bun run cz` (commitizen with
`cz-conventional-changelog` adapter, configured in `.czrc`).
