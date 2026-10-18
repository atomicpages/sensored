# Conformance suite

Golden fixtures that pin the TS reference engine's behaviour so other engines
(the Rust core and its napi and Wasm bindings) can be checked byte for byte.
See `docs/internal/plans/rust-core-rewrite.md`.

- `types.ts` is the fixture contract (format version 1) and the source of
  `JsonRedactorConfig`, the JSON-only config that crosses the FFI boundary.
  `bun run conformance:schema` regenerates
  `packages/sensored/schema/redactor-config.schema.json` from it.
- `generate.ts` runs the TS reference through the public API and writes
  `golden/`. Run with `bun run conformance:generate`.
- `golden/*.json` are committed. Their inputs are hand-written and safe to push.
- `golden/detectors/*.json` are derived from the eval corpus and gitignored,
  because synthetic tokens trip secret scanners. `golden/detectors.manifest.json`
  (committed) holds their SHA-256 digests and the corpus digest, so drift is
  caught after `bun run eval:generate` and `bun run conformance:generate`.

Fixtures record what the reference does, not what is correct. If a fixture
captures a bug, fix the TS reference and regenerate; never hand-edit a golden
file. Offsets are UTF-16 code units throughout.
