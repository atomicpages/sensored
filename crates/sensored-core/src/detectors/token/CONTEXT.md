# token

Ports of `packages/sensored/src/detectors/token/`. One file per TS file,
registered alphabetically in `mod.rs`.

## Kinds

- Format-only detectors (`github_token`, `npm_token`, ...): the TS loop is
  match, `isAdjacentForbidden`, one `<id>.format` reason, grapheme filter,
  which is the `ChecksumDetector` pipeline with a validator that accepts all.
- Keyword detectors (`datadog_api_key`, `okta_token`, ...): `KeywordDetector`
  table entries.
- Hand-written: `jwt_token` (trims trailing `_`), `private_key` (minimum body
  of 20 UTF-16 units measured in code), `generic_api_key` (value group,
  placeholder filter, inline context hint), `http_auth_header` (value group,
  custom headers).

## Porting notes

- Patterns without the `u` flag count `.` in UTF-16 units: `generic_api_key`
  builds its `.{0,5}` gap from BMP (one unit) and astral (two units) steps.
- `http_auth_header` compiles under `(?i-u)`; `js_space` / `js_non_space`
  re-enable Unicode for JS `\s` / `\S`. Custom headers are literals with JS
  non-`u` case folding (`Canonicalize`); a non-ASCII BMP char becomes the
  class of every BMP char with the same canonical form, found by a scan when
  the policy is resolved.
- Test values are built from filler (`fill`) so nothing looks like a secret.
