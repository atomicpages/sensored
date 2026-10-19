# financial

Ports of `packages/sensored/src/detectors/financial/`, one file per TS file.
Follow the recipe in `../national_id/CONTEXT.md`.

- `eu_vat` and `payment_card` are `ChecksumDetector`s (Luhn and the
  per-country VAT checks).
- `iban` is a hand-written `Detector`. When a match fails mod-97, trailing
  space-separated groups are dropped until it passes. Dropping stops at an
  all-digit group. Mod-97 folds through `u32`, which is equivalent to the TS
  `BigInt`.
- The rest are `ContextDetector`s. TS compiles their keywords with `gi` and
  no `u`, so they fold with `(?i-u:...)`, and JS `\s` is `JS_SPACE_CLASS`.
