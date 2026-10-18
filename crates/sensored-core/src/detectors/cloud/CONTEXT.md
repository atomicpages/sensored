# cloud

Ports of `packages/sensored/src/detectors/cloud/`, one file per TS file.
Follow the recipe in `../national_id/CONTEXT.md`.

Every TS `detect` is the checksum pipeline with no check, so each detector is
a `ChecksumDetector` whose `validate` always returns `["<id>.format"]`.
Patterns are case-sensitive ASCII; port them verbatim. Tests use obviously
fake keys, as the TS tests do.
