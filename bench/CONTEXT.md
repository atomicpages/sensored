# Performance benchmarks

Bun-only development tooling, outside the published `src/` boundary. Measures
acceptance performance targets using the `pii` preset (96 rules) plus vin, imei,
imsi, and tracking_number explicitly. Results are written to results.json and
are measured on the development host.

All 96 pii detectors are enabled (including person_name_lite): the `pii`
preset plus vin, imei, imsi, and tracking_number explicitly.
person_name_lite uses the lightweight regex + bloom filter detector (no
compromise.js at runtime), so it is included in benchmarks. The opt-in
person_name detector (compromise NER) is not included in benchmarks.

The 4 additional detectors (vin, imei, imsi, tracking_number) are added to all
three redaction mode benchmarks (redact, format-preserve, token-replace) and
an allowlist benchmark measures the performance impact of exact-match
allowlist filtering on chat and throughput workloads.

Timing uses [mitata](https://github.com/evanwashere/mitata) (`measure`,
`do_not_optimize`) for micro-benchmark accuracy. Stream delay and memory
measurements remain custom (mitata cannot measure time-to-first-output or RSS).
The `warmup` field in results is `"mitata-auto"` (mitata manages warmup
internally). p95 is interpolated from p75/p99 when raw samples are unavailable.

**Benchmark results (with lightweight person_name_lite):** All 6 targets met.
Chat p95 0.058ms (≤5ms PASS), chat p99 0.074ms (≤10ms PASS), doc p95 94ms
(≤100ms PASS), throughput 10.3 MiB/s (≥10 MiB/s PASS), RSS delta 0.7 MiB
(≤64 MiB PASS), stream delay p95 0.019ms (≤10ms PASS). Format-preserve and
token-replace modes perform nearly identically to redact (0.055-0.058ms chat
p95, 10.4 MiB/s throughput). Idle RSS 332.8 MiB (includes bloom filter data
decoded in memory).

**Additional detectors:** vin, imei, imsi, and tracking_number detectors added
to all three redaction mode benchmarks. Allowlist benchmark added to measure
the performance impact of exact-match allowlist filtering on chat and
throughput workloads.
