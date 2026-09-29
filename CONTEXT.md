# sensored

Portable deterministic text-redaction library, developed and tested with Bun.
The first complete-string email engine is implemented in src/.

## Sources of truth

- src/CONTEXT.md: architecture and module boundaries.

Coverage includes email, payment cards, national IDs, healthcare identifiers,
financial references, crypto addresses, VIN/IMEI/IMSI, tracking numbers, and
more. All built-in and trusted custom detectors share one contract. Published
code uses standard APIs; Bun-specific APIs belong in development tooling only.
This library has no HTTP server or database component.

src/index.ts exposes complete-string orchestration; src/policy.ts resolves
explicit rules and registrations; src/engine.ts resolves overlap
transformations. src/email.ts owns email candidate validation. src/types.ts and
src/detectors.ts define the registered detector/report seam. test/ contains Bun
regression tests. Each meaningful logic directory has a CONTEXT.md.

The package is published as `sensored` on npm. Versioning is automated via
semantic-release (`.releaserc.json`) triggered on push to main by
`.github/workflows/release.yml`. Conventional commits are enforced by commitlint
(`commitlint.config.ts`) via a `.husky/commit-msg` hook. Interactive commit
prompts are available via `bun run cz` (commitizen with
`cz-conventional-changelog` adapter, configured in `.czrc`).
