/**
 * Rust vs TS go/no-go benchmark (phase 2 of the Rust core rewrite).
 *
 * Runs the TS reference and the napi engine on the same config (the 20
 * detectors that dominate TS detection time on the benchmark inputs) and the
 * same inputs. Gate: native throughput >= 3x TS, and native p99 no worse than
 * TS on every chat workload. Outputs must match before timings count.
 *
 * Usage: bun bench/engine-gate.ts   (build the binding first:
 *        cd crates/sensored-napi && bun run build)
 */
import { createRequire } from "node:module";
import { do_not_optimize, measure } from "mitata";
import { createRedactor, type RedactorConfig } from "../src/index.ts";
import {
  CHAT_SIZE,
  DOC_SIZE,
  generateChatInput,
  generateUnicodeInput,
} from "./inputs.ts";

const GATE_RULES = [
  "email",
  "digital_identity",
  "license_plate",
  "to_id",
  "crypto_address",
  "fj_id",
  "png_id",
  "drivers_license",
  "postal_code",
  "address",
  "vin",
  "uk_nino",
  "payment_card",
  "phone",
  "person_name_lite",
  "au_tfn",
  "uz_stir",
  "tracking_number",
  "health_insurance_id",
  "ma_id",
] as const;

const THROUGHPUT_RATIO = 3;

interface NativeRedactor {
  redact(text: string): string;
}

interface NativeBinding {
  Redactor: { create(configJson: string): NativeRedactor };
}

function loadNative(): NativeBinding {
  const path =
    process.env.SENSORED_NATIVE ??
    new URL("../../../crates/sensored-napi/index.js", import.meta.url).pathname;

  return createRequire(import.meta.url)(path) as NativeBinding;
}

interface Stats {
  p50: number;
  p99: number;
  avg: number;
}

const nsToMs = (ns: number): number => ns / 1_000_000;

async function time(fn: () => unknown): Promise<Stats> {
  const stats = (await measure(function* () {
    yield () => do_not_optimize(fn());
  })) as { p50: number; p99: number; avg: number };

  return {
    p50: nsToMs(stats.p50),
    p99: nsToMs(stats.p99),
    avg: nsToMs(stats.avg),
  };
}

const config: RedactorConfig = {
  rules: Object.fromEntries(
    GATE_RULES.map((id) => [id, { action: "redact" as const }]),
  ),
};

const ts = createRedactor(config);
const native = loadNative().Redactor.create(JSON.stringify(config));

const workloads = {
  chatAscii: generateChatInput(CHAT_SIZE, "low"),
  chatAsciiHigh: generateChatInput(CHAT_SIZE, "high"),
  chatUnicode: generateUnicodeInput(CHAT_SIZE),
  docAscii: generateChatInput(DOC_SIZE, "low"),
  docUnicode: generateUnicodeInput(DOC_SIZE),
};

// Parity first: a speedup on different output is meaningless.
const mismatches = Object.entries(workloads).filter(
  ([, input]) => ts.redact(input) !== native.redact(input),
);

if (mismatches.length > 0) {
  console.error(
    `Output mismatch on: ${mismatches.map(([name]) => name).join(", ")}`,
  );
  process.exit(1);
}

const rows: Record<string, { ts: Stats; native: Stats }> = {};

for (const [name, input] of Object.entries(workloads)) {
  rows[name] = {
    ts: await time(() => ts.redact(input)),
    native: await time(() => native.redact(input)),
  };
}

const mibPerSec = (stats: Stats): number => 1 / (stats.avg / 1000);

const report = Object.entries(rows).map(([name, { ts, native }]) => ({
  workload: name,
  tsP99: ts.p99.toFixed(3),
  nativeP99: native.p99.toFixed(3),
  speedup: (ts.avg / native.avg).toFixed(2),
}));

console.table(report);

const docRows = [rows.docAscii, rows.docUnicode].filter(
  (row) => row !== undefined,
);
const throughput = docRows.map((row) => ({
  ts: mibPerSec(row.ts),
  native: mibPerSec(row.native),
}));

const throughputOk = throughput.every(
  (row) => row.native >= THROUGHPUT_RATIO * row.ts,
);

const chatRows = Object.entries(rows).filter(([name]) =>
  name.startsWith("chat"),
);
const p99Ok = chatRows.every(([, row]) => row.native.p99 <= row.ts.p99);

for (const [i, row] of throughput.entries()) {
  console.log(
    `${i === 0 ? "docAscii" : "docUnicode"}: TS ${row.ts.toFixed(1)} MiB/s, native ${row.native.toFixed(1)} MiB/s (${(row.native / row.ts).toFixed(2)}x)`,
  );
}

console.log(
  `Gate: throughput >= ${THROUGHPUT_RATIO}x ${throughputOk ? "PASS" : "FAIL"}; chat p99 no worse ${p99Ok ? "PASS" : "FAIL"}`,
);

await Bun.write(
  new URL("./gate-results.json", import.meta.url),
  `${JSON.stringify({ rules: GATE_RULES, rows, throughputOk, p99Ok }, null, 2)}\n`,
);

process.exitCode = throughputOk && p99Ok ? 0 : 1;
