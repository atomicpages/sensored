# healthcare

Ports of `packages/sensored/src/detectors/healthcare/`, one file per TS file.
Follow the recipe in `../national_id/CONTEXT.md`.

- Every detector is a `ContextDetector` except `us_npi`, whose TS `detect`
  is the checksum pipeline, so it is a `ChecksumDetector`.
- `ts_ascii_ci` (in `mod.rs`) compiles a TS `/.../gi` pattern inside
  `(?i-u:...)`, so folding, `\d` and `[A-Z]` stay ASCII. Write JS `\s` as
  `{s}` and `[-\s]` as `{sep}`; both expand to `JS_SPACE_CLASS`. Use it for
  patterns with keyword prefixes (`SUBJECT`, `PACEMAKER`) that `(?i)` would
  let `ſ` or the Kelvin sign match.
