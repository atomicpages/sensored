# identity

Ports of `packages/sensored/src/detectors/identity/`, one file per TS file.
Follow the recipe in `../national_id/CONTEXT.md`.

- `imei` (Luhn) and `vin` (check digit) are `ChecksumDetector`s.
- `drivers_license`, `imsi`, `license_plate` and `passport` are
  `ContextDetector`s that need a label nearby.
- `digital_identity` is a hand-written `Detector` for usernames, handles,
  Discord IDs and Steam IDs.
