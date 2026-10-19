# hr

Ports of `packages/sensored/src/detectors/hr/`, one file per TS file.
Follow the recipe in `../national_id/CONTEXT.md`.

- `hr_identifier`, `hr_recruitment` and `hr_screening` are
  `ContextDetector`s.
- `hr_compensation` is a hand-written `Detector`. Its two patterns (amounts,
  then plan IDs) share one context matcher. A span that both patterns find is
  reported once, in amount order, as in TS.
