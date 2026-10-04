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
Chat p95 0.760ms (≤5ms PASS), chat p99 1.231ms (≤10ms PASS), doc p95 193ms
(≤300ms PASS), throughput 5.6 MiB/s (≥4.5 MiB/s PASS), RSS delta 15.5 MiB
(≤64 MiB PASS), stream delay p95 0.061ms (≤10ms PASS). Format-preserve and
token-replace modes perform nearly identically to redact (0.470-0.495ms chat
p95, 5.4-5.5 MiB/s throughput). Idle RSS 202.5 MiB (includes bloom filter data
decoded in memory).

Targets were re-baselined after an environmental change (macOS update)
reduced throughput by ~2x compared to the original baseline (doc p95 94ms,
throughput 10.3 MiB/s). The regression is environmental, not code-related:
running the original commit's code produces the same degraded numbers.

**Additional detectors:** vin, imei, imsi, and tracking_number detectors added
to all three redaction mode benchmarks. Allowlist benchmark added to measure
the performance impact of exact-match allowlist filtering on chat and
throughput workloads.

**Session benchmark:** Added to measure session-level redaction performance.
The session uses `dedup: true` which adds reverse-lookup cost for repeated PII
values across calls. Measures chat p95 (4 KiB input, same as chat workload),
throughput (MiB/s, same 1 MiB input as throughput benchmark), restore p95
(redacting then restoring a 4 KiB chat input), and dedup overhead (5 sequential
redact calls with overlapping PII values to measure reverse-lookup cost).
