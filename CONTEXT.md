# sensored

Portable deterministic text-redaction library, developed and tested with Bun.
The first complete-string email engine is implemented in `packages/sensored/src/`.

## Sources of truth

- packages/sensored/src/CONTEXT.md: architecture and module boundaries.

Coverage includes email, payment cards, national IDs, healthcare identifiers,
financial references, crypto addresses, VIN/IMEI/IMSI, tracking numbers, and
more. All built-in and trusted custom detectors share one contract. Published
code uses standard APIs; Bun-specific APIs belong in development tooling only.
This library has no HTTP server or database component.

`packages/sensored/src/index.ts` exposes complete-string orchestration;
`packages/sensored/src/policy.ts` resolves explicit rules and registrations;
`packages/sensored/src/engine.ts` resolves overlap transformations.
`packages/sensored/src/email.ts` owns email candidate validation.
`packages/sensored/src/types.ts` and `packages/sensored/src/detectors.ts`
define the registered detector/report seam. `packages/sensored/test/` contains
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

The package is published as `sensored` on npm. Versioning is automated via
semantic-release (`.releaserc.json`) triggered on push to main by
`.github/workflows/release.yml`. Conventional commits are enforced by commitlint
(`commitlint.config.ts`) via a `.husky/commit-msg` hook. Interactive commit
prompts are available via `bun run cz` (commitizen with
`cz-conventional-changelog` adapter, configured in `.czrc`).
