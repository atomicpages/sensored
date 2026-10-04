import { do_not_optimize, measure } from "mitata";
import { createRedactor } from "../src/index.ts";
import { createSession } from "../src/session.ts";
import type { StreamEvent } from "../src/types.ts";

// person_name_lite uses lightweight regex + bloom filter (no compromise.js).
// All pii detectors including person_name_lite are benchmarked.
// The pii preset includes 96 rules; vin, imei, imsi, and tracking_number
// are added explicitly to exercise these detectors in mode-specific benchmarks.
const extraRules = {
  vin: { action: "redact" as const },
  imei: { action: "redact" as const },
  imsi: { action: "redact" as const },
  tracking_number: { action: "redact" as const },
};

const redactor = createRedactor({
  presets: ["pii"],
  rules: extraRules,
});

const formatPreserveRedactor = createRedactor({
  presets: ["pii"],
  rules: {
    vin: { action: "format-preserve" as const },
    imei: { action: "format-preserve" as const },
    imsi: { action: "format-preserve" as const },
    tracking_number: { action: "format-preserve" as const },
  },
});

const tokenReplaceRedactor = createRedactor({
  presets: ["pii"],
  rules: {
    vin: { action: "token-replace" as const },
    imei: { action: "token-replace" as const },
    imsi: { action: "token-replace" as const },
    tracking_number: { action: "token-replace" as const },
  },
});

const allowlistRedactor = createRedactor({
  presets: ["pii"],
  rules: extraRules,
  allowlist: [
    "123-45-6789",
    "4242 4242 4242 4242",
    "user@example.com",
    "+1 555 123 4567",
    "AB123456C",
    "123-456-789",
    "123 456 789",
    "1234 5678 9012",
    "DE123456789",
    "GB29 NWBK 6016 1331 9268 19",
    "123456789",
    "D1234567",
    "John Smith",
  ],
});

const session = createSession({
  presets: ["pii"],
  rules: extraRules,
});

const CHAT_SIZE = 4096;
const DOC_SIZE = 1_048_576;
const FRAGMENT_SIZES = [1, 16, 256, 4096];
const STREAM_DELAY_ITERATIONS = 50;

interface TimingResult {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
}

interface BenchReport {
  hardware: string;
  os: string;
  runtime: string;
  warmup: string;
  chat: {
    ascii: Record<string, TimingResult>;
    unicode: TimingResult;
    densities: Record<string, TimingResult>;
  };
  longDocument: {
    ascii: TimingResult;
    unicode: TimingResult;
  };
  throughput: {
    complete: { mibPerSec: number; result: TimingResult };
    stream: { mibPerSec: number; result: TimingResult };
  };
  streaming: {
    fragmentSizes: Record<string, TimingResult>;
    reportOff: TimingResult;
    reportOn: TimingResult;
  };
  streamDelay: {
    p95: number;
    p99: number;
    mean: number;
  };
  memory: {
    idleRss: number;
    peakRss: number;
    delta: number;
  };
  newModes: {
    formatPreserve: { chatP95: number; throughputMibPerSec: number };
    tokenReplace: { chatP95: number; throughputMibPerSec: number };
  };
  allowlist: {
    chatP95: number;
    throughputMibPerSec: number;
  };
  session: {
    chatP95: number;
    throughputMibPerSec: number;
    restoreP95: number;
    dedupP95: number;
  };
  targets: {
    chatP95: number;
    chatP99: number;
    docP95: number;
    throughput: number;
    rssDelta: number;
    streamDelayP95: number;
  };
  targetMet: Record<string, boolean>;
}

const PII_SAMPLES = [
  "SSN: 123-45-6789 ",
  "Card: 4242 4242 4242 4242 ",
  "email: user@example.com ",
  "phone: +1 555 123 4567 ",
  "NINO: AB123456C ",
  "SIN: 123-456-789 ",
  "TFN: 123 456 789 ",
  "My Number: 1234 5678 9012 ",
  "VAT: DE123456789 ",
  "IBAN: GB29 NWBK 6016 1331 9268 19 ",
  "Passport: 123456789 ",
  "DL: D1234567 ",
  "John Smith said ",
  "VIN: 1HGCM82633A123456 ",
  "IMEI: 490154203237518 ",
  "IMSI: 310150123456789 ",
  "Tracking: 1Z999AA10123456784 ",
];

const PII_HIGH = PII_SAMPLES.join("");

function generateChatInput(
  size: number,
  density: "none" | "low" | "high",
): string {
  const parts: string[] = [];
  let remaining = size;

  while (remaining > 0) {
    if (density === "none") {
      parts.push("ordinary text without any sensitive data here ");
    } else if (density === "low") {
      const idx = Math.floor(Math.random() * PII_SAMPLES.length);
      if (Math.random() < 0.15) {
        parts.push(PII_SAMPLES[idx] ?? "");
      } else {
        parts.push("ordinary text without any sensitive data here ");
      }
    } else {
      parts.push(PII_HIGH);
    }

    remaining -= parts[parts.length - 1]?.length ?? 0;
  }

  return parts.join("").slice(0, size);
}

function generateUnicodeInput(size: number): string {
  const parts: string[] = [
    "\uD83D\uDE00 SSN: 123-45-6789 ",
    "e\u0301\u0302\u0303 Card: 4242 4242 4242 4242 ",
    "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67 email: user@example.com ",
    "na\u0308ive phone: +1 555 123 4567 ",
    "\uD83C\uDDEC\uD83C\uDDE7 IBAN: GB29 NWBK 6016 1331 9268 19 ",
    "Passport: 123456789 DL: D1234567 ",
    "John Smith said NINO: AB123456C ",
  ];

  let result = "";
  while (result.length < size) {
    result += parts[Math.floor(Math.random() * parts.length)];
  }
  return result.slice(0, size);
}

async function* toChunks(text: string, size: number): AsyncIterable<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}

async function collectText(
  events: AsyncIterable<StreamEvent>,
): Promise<string> {
  let text = "";
  for await (const event of events) {
    if (event.type === "text") {
      text += event.text;
    }
    if (event.type === "detection") {
      text += event.group.replacement;
    }
  }
  return text;
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function getRss(): number {
  return process.memoryUsage().rss / 1024 / 1024;
}

const nsToMs = (ns: number): number => ns / 1_000_000;

interface MitataStats {
  min: number;
  max: number;
  avg: number;
  p25: number;
  p50: number;
  p75: number;
  p99: number;
  p999: number;
  ticks: number;
  samples?: number[];
}

function toTimingResult(stats: MitataStats): TimingResult {
  let p95: number;
  if (
    stats.samples &&
    Array.isArray(stats.samples) &&
    stats.samples.length > 0
  ) {
    const sorted = [...stats.samples].sort((a, b) => a - b);
    p95 = nsToMs(percentile(sorted, 95));
  } else {
    const p75 = stats.p75 ?? 0;
    const p99 = stats.p99 ?? 0;
    p95 = nsToMs(p75 + 0.8 * (p99 - p75));
  }

  return {
    p50: nsToMs(stats.p50 ?? 0),
    p95,
    p99: nsToMs(stats.p99 ?? 0),
    mean: nsToMs(stats.avg ?? 0),
    min: nsToMs(stats.min ?? 0),
    max: nsToMs(stats.max ?? 0),
  };
}

async function benchSync(fn: () => unknown): Promise<MitataStats> {
  return (await measure(function* () {
    yield () => do_not_optimize(fn());
  })) as MitataStats;
}

async function benchAsync(fn: () => Promise<unknown>): Promise<MitataStats> {
  return (await measure(function* () {
    yield fn;
  })) as MitataStats;
}

// --- Generate inputs ---

const chatAsciiNone = generateChatInput(CHAT_SIZE, "none");
const chatAsciiLow = generateChatInput(CHAT_SIZE, "low");
const chatAsciiHigh = generateChatInput(CHAT_SIZE, "high");
const chatUnicode = generateUnicodeInput(CHAT_SIZE);
const docAscii = generateChatInput(DOC_SIZE, "low");
const docUnicode = generateUnicodeInput(DOC_SIZE);
const streamInput = generateChatInput(CHAT_SIZE * 10, "low");
const throughputInput = generateChatInput(DOC_SIZE, "low");

console.log("=== sensored performance benchmarks (mitata) ===\n");

// --- Chat workload (4 KiB) ---

console.log("--- Chat workload (4 KiB) ---");

const chatNoneResult = toTimingResult(
  await benchSync(() => redactor.redact(chatAsciiNone)),
);
console.log(
  `  ASCII no PII:   p95=${chatNoneResult.p95.toFixed(3)}ms p99=${chatNoneResult.p99.toFixed(3)}ms`,
);

const chatLowResult = toTimingResult(
  await benchSync(() => redactor.redact(chatAsciiLow)),
);
console.log(
  `  ASCII low PII:  p95=${chatLowResult.p95.toFixed(3)}ms p99=${chatLowResult.p99.toFixed(3)}ms`,
);

const chatHighResult = toTimingResult(
  await benchSync(() => redactor.redact(chatAsciiHigh)),
);
console.log(
  `  ASCII high PII: p95=${chatHighResult.p95.toFixed(3)}ms p99=${chatHighResult.p99.toFixed(3)}ms`,
);

const chatUnicodeResult = toTimingResult(
  await benchSync(() => redactor.redact(chatUnicode)),
);
console.log(
  `  Unicode:        p95=${chatUnicodeResult.p95.toFixed(3)}ms p99=${chatUnicodeResult.p99.toFixed(3)}ms`,
);

// --- Long document (1 MiB) ---

console.log("\n--- Long document (1 MiB) ---");

const docAsciiResult = toTimingResult(
  await benchSync(() => redactor.redact(docAscii)),
);
console.log(`  ASCII:   p95=${docAsciiResult.p95.toFixed(3)}ms`);

const docUnicodeResult = toTimingResult(
  await benchSync(() => redactor.redact(docUnicode)),
);
console.log(`  Unicode: p95=${docUnicodeResult.p95.toFixed(3)}ms`);

// --- Sustained throughput ---

console.log("\n--- Sustained throughput ---");

const completeThroughputStats = await benchSync(() =>
  redactor.redact(throughputInput),
);
const completeThroughputMibPerSec =
  DOC_SIZE / 1024 / 1024 / (nsToMs(completeThroughputStats.avg) / 1000);
console.log(
  `  Complete-string: ${completeThroughputMibPerSec.toFixed(1)} MiB/s`,
);

const streamThroughputStats = await benchAsync(() =>
  collectText(redactor.stream(toChunks(throughputInput, 4096))),
);
const streamThroughputMibPerSec =
  DOC_SIZE / 1024 / 1024 / (nsToMs(streamThroughputStats.avg) / 1000);
console.log(`  Streaming:       ${streamThroughputMibPerSec.toFixed(1)} MiB/s`);

// --- Streaming across fragment sizes ---

console.log("\n--- Streaming across fragment sizes ---");

const fragmentResults: Record<string, TimingResult> = {};
for (const size of FRAGMENT_SIZES) {
  const result = toTimingResult(
    await benchAsync(() =>
      collectText(redactor.stream(toChunks(streamInput, size))),
    ),
  );
  fragmentResults[String(size)] = result;
  console.log(
    `  fragment=${String(size).padStart(4)}: p95=${result.p95.toFixed(3)}ms p99=${result.p99.toFixed(3)}ms`,
  );
}

// --- Reporting on/off ---

console.log("\n--- Reporting on/off ---");

const reportOffResult = toTimingResult(
  await benchAsync(() =>
    collectText(redactor.stream(toChunks(streamInput, 256), { report: false })),
  ),
);
console.log(`  report=false: p95=${reportOffResult.p95.toFixed(3)}ms`);

const reportOnResult = toTimingResult(
  await benchAsync(() =>
    collectText(redactor.stream(toChunks(streamInput, 256), { report: true })),
  ),
);
console.log(`  report=true:  p95=${reportOnResult.p95.toFixed(3)}ms`);

// --- Stream processing delay ---

console.log("\n--- Stream processing delay ---");

const delayInput = generateChatInput(CHAT_SIZE, "low");
const delaySamples: number[] = [];

for (let i = 0; i < STREAM_DELAY_ITERATIONS; i++) {
  const start = performance.now();
  let firstOutput = 0;

  for await (const event of redactor.stream(toChunks(delayInput, 256))) {
    if (
      firstOutput === 0 &&
      (event.type === "text" || event.type === "detection")
    ) {
      firstOutput = performance.now() - start;
      break;
    }
  }

  if (firstOutput > 0) {
    delaySamples.push(firstOutput);
  }
}

const sortedDelay = delaySamples.sort((a, b) => a - b);
const streamDelayP95 = percentile(sortedDelay, 95);
const streamDelayP99 = percentile(sortedDelay, 99);
const streamDelayMean =
  sortedDelay.reduce((a, b) => a + b, 0) / sortedDelay.length;

console.log(
  `  p95=${streamDelayP95.toFixed(3)}ms p99=${streamDelayP99.toFixed(3)}ms mean=${streamDelayMean.toFixed(3)}ms`,
);

// --- Memory ---

console.log("\n--- Memory ---");

const idleRss = getRss();
let peakRss = idleRss;

for (let i = 0; i < 20; i++) {
  redactor.redact(docAscii);
  const current = getRss();
  if (current > peakRss) {
    peakRss = current;
  }
}

const memoryDelta = peakRss - idleRss;

console.log(`  Idle RSS: ${idleRss.toFixed(1)} MiB`);
console.log(`  Peak RSS: ${peakRss.toFixed(1)} MiB`);
console.log(`  Delta:    ${memoryDelta.toFixed(1)} MiB`);

// --- New modes benchmark ---

console.log("\n--- New redaction modes ---");

const formatPreserveChatResult = toTimingResult(
  await benchSync(() => formatPreserveRedactor.redact(chatAsciiLow)),
);
console.log(
  `  format-preserve chat p95: ${formatPreserveChatResult.p95.toFixed(3)}ms`,
);

const formatPreserveThroughputStats = await benchSync(() =>
  formatPreserveRedactor.redact(throughputInput),
);
const formatPreserveThroughputMib =
  DOC_SIZE / 1024 / 1024 / (nsToMs(formatPreserveThroughputStats.avg) / 1000);
console.log(
  `  format-preserve throughput: ${formatPreserveThroughputMib.toFixed(1)} MiB/s`,
);

const tokenReplaceChatResult = toTimingResult(
  await benchSync(() => tokenReplaceRedactor.redact(chatAsciiLow)),
);
console.log(
  `  token-replace chat p95: ${tokenReplaceChatResult.p95.toFixed(3)}ms`,
);

const tokenReplaceThroughputStats = await benchSync(() =>
  tokenReplaceRedactor.redact(throughputInput),
);
const tokenReplaceThroughputMib =
  DOC_SIZE / 1024 / 1024 / (nsToMs(tokenReplaceThroughputStats.avg) / 1000);
console.log(
  `  token-replace throughput: ${tokenReplaceThroughputMib.toFixed(1)} MiB/s`,
);

// --- Allowlist benchmark ---

console.log("\n--- Allowlist ---");

const allowlistChatResult = toTimingResult(
  await benchSync(() => allowlistRedactor.redact(chatAsciiLow)),
);
console.log(`  allowlist chat p95: ${allowlistChatResult.p95.toFixed(3)}ms`);

const allowlistThroughputStats = await benchSync(() =>
  allowlistRedactor.redact(throughputInput),
);
const allowlistThroughputMib =
  DOC_SIZE / 1024 / 1024 / (nsToMs(allowlistThroughputStats.avg) / 1000);
console.log(
  `  allowlist throughput: ${allowlistThroughputMib.toFixed(1)} MiB/s`,
);

// --- Session benchmark ---

console.log("\n--- Session ---");

const sessionChatResult = toTimingResult(
  await benchSync(() => session.redact(chatAsciiLow)),
);
console.log(`  session chat p95: ${sessionChatResult.p95.toFixed(3)}ms`);

const sessionThroughputStats = await benchSync(() =>
  session.redact(throughputInput),
);
const sessionThroughputMib =
  DOC_SIZE / 1024 / 1024 / (nsToMs(sessionThroughputStats.avg) / 1000);
console.log(`  session throughput: ${sessionThroughputMib.toFixed(1)} MiB/s`);

const redactedText = session.redact(chatAsciiLow);
const sessionRestoreResult = toTimingResult(
  await benchSync(() => session.restore(redactedText)),
);
console.log(`  session restore p95: ${sessionRestoreResult.p95.toFixed(3)}ms`);

const sessionDedupResult = toTimingResult(
  await benchSync(() => {
    session.redact(chatAsciiLow);
    session.redact(chatAsciiLow);
    session.redact(chatAsciiLow);
    session.redact(chatAsciiLow);
    session.redact(chatAsciiLow);
  }),
);
console.log(`  session dedup p95: ${sessionDedupResult.p95.toFixed(3)}ms`);

// --- Target evaluation ---

console.log("\n--- Target evaluation ---");

const targets = {
  chatP95: 5,
  chatP99: 10,
  docP95: 300,
  throughput: 4.5,
  rssDelta: 64,
  streamDelayP95: 10,
};

const targetMet = {
  chatP95: chatLowResult.p95 <= targets.chatP95,
  chatP99: chatLowResult.p99 <= targets.chatP99,
  docP95: docAsciiResult.p95 <= targets.docP95,
  throughput: completeThroughputMibPerSec >= targets.throughput,
  rssDelta: memoryDelta <= targets.rssDelta,
  streamDelayP95: streamDelayP95 <= targets.streamDelayP95,
};

for (const [target, met] of Object.entries(targetMet)) {
  console.log(`  ${target}: ${met ? "PASS" : "FAIL"}`);
}

// --- Write results ---

const report: BenchReport = {
  hardware: "Apple M3 Pro, 36 GiB RAM",
  os: "macOS 26.6.2 build 25G83",
  runtime: "Bun 1.4.2",
  warmup: "mitata-auto",
  chat: {
    ascii: {
      none: chatNoneResult,
      low: chatLowResult,
      high: chatHighResult,
    },
    unicode: chatUnicodeResult,
    densities: {},
  },
  longDocument: {
    ascii: docAsciiResult,
    unicode: docUnicodeResult,
  },
  throughput: {
    complete: {
      mibPerSec: completeThroughputMibPerSec,
      result: toTimingResult(completeThroughputStats),
    },
    stream: {
      mibPerSec: streamThroughputMibPerSec,
      result: toTimingResult(streamThroughputStats),
    },
  },
  streaming: {
    fragmentSizes: fragmentResults,
    reportOff: reportOffResult,
    reportOn: reportOnResult,
  },
  streamDelay: {
    p95: streamDelayP95,
    p99: streamDelayP99,
    mean: streamDelayMean,
  },
  memory: {
    idleRss,
    peakRss,
    delta: memoryDelta,
  },
  newModes: {
    formatPreserve: {
      chatP95: formatPreserveChatResult.p95,
      throughputMibPerSec: formatPreserveThroughputMib,
    },
    tokenReplace: {
      chatP95: tokenReplaceChatResult.p95,
      throughputMibPerSec: tokenReplaceThroughputMib,
    },
  },
  allowlist: {
    chatP95: allowlistChatResult.p95,
    throughputMibPerSec: allowlistThroughputMib,
  },
  session: {
    chatP95: sessionChatResult.p95,
    throughputMibPerSec: sessionThroughputMib,
    restoreP95: sessionRestoreResult.p95,
    dedupP95: sessionDedupResult.p95,
  },
  targets,
  targetMet,
};

await Bun.write("bench/results.json", `${JSON.stringify(report, null, 2)}\n`);
console.log("\nResults written to bench/results.json");
