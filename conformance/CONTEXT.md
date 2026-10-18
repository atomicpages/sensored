# Conformance suite

Golden fixtures that pin the TS reference engine's behaviour so other engines
(the Rust core and its napi and Wasm bindings) can be checked byte for byte.
See `docs/internal/plans/rust-core-rewrite.md`.

- `types.ts` is the fixture contract (format version 1) and the source of
  `JsonRedactorConfig`, the JSON-only config that crosses the FFI boundary.
  `bun run conformance:schema` regenerates
  `packages/sensored/schema/redactor-config.schema.json` from it.
- `generate.ts` writes `golden/` (`bun run conformance:generate`). With
  `--check` (`bun run conformance:check`) it regenerates in memory and exits 1
  listing every stale file and the case ids added (`+`), removed (`-`) or
  changed (`~`).
- `reference.ts` runs the TS reference through its real APIs
  (`createRedactor().inspect/stream`, `resolvePolicy`, `restore`,
  `StreamRestorer`) and fills each seed's `expected`. Stream and streamed
  restore seeds are run at every code-point split and one chunk per code
  point. A stream seed whose chunkings disagree is excluded; a restore seed is
  kept with `streamed: false`. Both are printed as findings, never hidden.
- `seeds/` holds the hand-written inputs, one module per committed file, plus
  `values.ts` (shared fake values). Render seeds with `restore: true` also
  become `from-render/*` restore cases. Keep stream inputs under ~300 UTF-16
  units, and pick rules with small stream windows (ipv4, phone, payment_card,
  us_ssn) so splits actually cross mid-stream flushes.
- `detectors.ts` builds `golden/detectors/<rule>.json` from
  `packages/sensored/eval/corpus.json`: every non-deferred case labelled with
  the rule, plus the first 100 negatives by id, rendered with
  `{ rules: { [rule]: { action: "redact" } } }`. Without the corpus, generate
  and check skip these files with a notice.
- `golden/*.json` are committed. Their inputs are hand-written and safe to push.
  `render.json` includes `detector-edge/*` cases: detector rules the eval
  corpus never exercises (HMRC NINO rules, digit-required IDs, case folding,
  card group bounds, email and postal boundaries). Add one whenever a
  detector rule is fixed or a port could plausibly miss it.
- `golden/detectors/*.json` are derived from the eval corpus and gitignored,
  because synthetic tokens trip secret scanners. `golden/detectors.manifest.json`
  (committed) holds their SHA-256 digests and the corpus digest, so drift is
  caught after `bun run eval:generate` and `bun run conformance:generate`.

Fixtures record what the reference does, not what is correct. If a fixture
captures a bug, fix the TS reference and regenerate; never hand-edit a golden
file. Offsets are UTF-16 code units throughout.
