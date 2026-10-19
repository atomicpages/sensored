# contact

Ports of `packages/sensored/src/detectors/contact/`, one file per TS file.
Follow the recipe in `../national_id/CONTEXT.md`.

- `address` is a `ContextDetector`.
- `email`, `phone` and `postal_code` are hand-written `Detector`s. `detection`
  (in `mod.rs`) builds their detections; `found` is a test helper.
- `email` expands from each `@` over ASCII bytes only, and rejects a
  candidate that would take a non-ASCII character. The TS grammars reject
  those too, so its UTF-16 lengths are byte lengths.
