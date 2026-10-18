# network

Ports of `packages/sensored/src/detectors/network/`, one file per TS file.
Follow the recipe in `../national_id/CONTEXT.md`.

- `ipv4` and `ipv6` are `ChecksumDetector`s: their TS `detect` is the
  checksum pipeline, with the exclusion check (`isExcluded`, `isValid`) as
  `validate`.
- `mac_address`, `url_query_key` and `url_with_auth` are hand-written
  `Detector`s: two patterns plus a seventh-group check, a capture group, and
  trailing `_`/`.` trimming. `format_detection` (in `mod.rs`) builds their
  `<id>.format` detections.
- TS quirk kept: `url_query_key` places the value at its first occurrence in
  the whole match (`indexOf`), which can fall inside the key name.
- JS `\s` is `JS_SPACE_CLASS`; `url_query_key`'s `/i` (no `u`) is
  `(?i-u:...)` around the key names only.
