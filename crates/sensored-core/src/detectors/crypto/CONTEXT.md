# crypto

Ports of `packages/sensored/src/detectors/crypto/`, one file per TS file.
Follow the recipe in `../national_id/CONTEXT.md`.

- `crypto_tx_hash` is a `ContextDetector`.
- `crypto_address` is a hand-written `Detector`: one format-only pattern
  (with no checksum, as in TS), plus the adjacency check and `push_aligned`.
