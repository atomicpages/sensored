# Releasing

`.github/workflows/release.yml` publishes, in order: the 7
`@sensored/native-<platform>` packages (`napi pre-publish`), then
`@sensored/native`, `sensored` and the other public `packages/*`
(`scripts/publish.ts`, which skips versions already on npm), then a GitHub
release `sensored@<version>` with the compiled CLI binaries for the same 7
platforms. Bun cross-compiles them on Linux, and only `linux-x64` is
smoke-tested; the other 6 haven't been run yet, so check them after the first
release. `sensored` and
`@sensored/native` share one version (changesets `fixed` group).

## `sensored@next` (prereleases, until parity)

1. On the release branch: `bunx changeset pre enter next`, then
   `bunx changeset version && bun install && bunx napi version --cwd crates/sensored-napi`.
   Commit and push. Versions are now `x.y.z-next.N`.
2. Actions > Release > Run workflow on that branch, `tag: next`. Tick `crate`
   to also publish `sensored-core` to crates.io.
3. Repeat 1 (`changeset version` only) and 2 for each prerelease.

The workflow refuses `next` with a stable version and `latest` with a
prerelease.

## `latest` (the major, after the soak)

`bunx changeset pre exit`, merge to `main`. The push opens the "version
packages" PR; merging it publishes as `latest` (or run the workflow with
`tag: latest`).

## Secrets and settings

- Environment `npm`: npm trusted publishing (OIDC, no token) for every
  package: `sensored`, `@sensored/enterprise`, `@sensored/native` and the 7
  `@sensored/native-<platform>`, each with this repo and `release.yml`. A
  trusted publisher can only be added to a package that exists, so for the
  first release set an `NPM_TOKEN` secret (granular, publish rights on the
  `@sensored` scope and `sensored`) on the environment, publish, configure
  the trusted publishers, then delete the secret. If the environment limits
  deployment branches, allow the prerelease branch.
- Environment `crates-io`: secret `CARGO_REGISTRY_TOKEN` (crates.io token
  with `publish-new` and `publish-update` for `sensored-core`).
- `GITHUB_TOKEN`: the version PR, the GitHub release and binary uploads.

## Check locally first

- `cargo package -p sensored-core --list`
- `bun pm pack --dry-run` in `packages/sensored` and `crates/sensored-napi`
- `bun scripts/publish.ts --tag next --dry-run` packs each package and runs
  `npm publish --dry-run` (no upload, no provenance)
