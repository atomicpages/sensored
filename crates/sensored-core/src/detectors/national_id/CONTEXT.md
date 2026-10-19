# national_id

Ports of `packages/sensored/src/detectors/national-id/`. One file per TS
file (`to-id.ts` becomes `to_id.rs`), each exposing
`pub(super) fn detector() -> <Kind>`. `mod.rs` declares the module and adds
one `registry.insert(Arc::new(x::detector()))` line to `register`. Keep both
lists alphabetical.

## Picking the kind

- TS `extends ContextDetector` → `ContextDetector` table entry.
- TS `extends ChecksumDetector` → `ChecksumDetector` table entry.
- TS `extends Detector` with a hand-written `detect` → first check whether the
  loop is the checksum pipeline (match, `isAdjacentForbidden`, check, push,
  `filterGraphemeAligned`, no context hint). If so, use `ChecksumDetector` and
  return the TS reasons from `validate` (see `uk_nino.rs`). Otherwise write a
  struct implementing `Detector`, reusing `is_adjacent_forbidden`,
  `push_aligned` and `ContextMatcher` from `crate::detector`.

## Translating fields

| TS | Rust |
|---|---|
| `pattern` | `pattern: LazyLock::new(\|\| regex(r"..."))`, ported per the crate's Regex porting rules. `/i` without `/u` folds ASCII only, so write `[A-Za-z]`, not `(?i)` (which would match `ſ` and the Kelvin sign). No `i` flag means uppercase only. |
| `contextLabels` | `const LABELS: &str`, passed verbatim to `ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)`. Translate only JS-specific escapes (e.g. `\d` inside a label). The matcher adds `(?i)` as TS adds `iu`. |
| `labelStrings` | `labels: &[...]`, same order. |
| `leftContext` / `rightContext` | `const WINDOW: (usize, usize)`, UTF-16 units. |
| `validate` override | `validate: Some(fn)` (`None` keeps the default `["<id>.format"]`). Return `None` for `false`, `Some(&[...])` with the exact TS reasons. Work on bytes, avoid allocating (see `au_tfn.rs`). |
| `stream = streamMeta(n, l, r)` or a frozen object | `StreamMeta::new(n, l, r)`; `boundaryLookaround` is always 1. The metadata test compares it to TS. |
| Checksum helpers | `crate::checksum` (Luhn, NPI). A helper only this family needs goes in `mod.rs`; report it so the lead can promote it. |

## Tests

Port the meaningful cases of `packages/sensored/test/<id>.test.ts` as unit
tests in the detector file, using `mod.rs`'s `test_support`:
`assert_context_shape(&detector, label, value)` covers the label placement
table every `ContextDetector` test repeats; `values` and `spans` cover the
rest. A label that contains another label as a suffix (`Papua New Guinea`)
fails the `my` prefix case; check it on its own. Golden parity:
`SENSORED_DETECTORS=<ids> cargo test --test detectors`.
