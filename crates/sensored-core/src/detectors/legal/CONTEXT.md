# legal

Ports of `packages/sensored/src/detectors/legal/`, one file per TS file.
Follow the recipe in `../national_id/CONTEXT.md`.

All three are `ContextDetector`s whose `validate` requires an ASCII digit
(`has_digit` in `mod.rs`, TS `/\d/.test`). Their label regexes and
`labelStrings` are copied verbatim from TS.
