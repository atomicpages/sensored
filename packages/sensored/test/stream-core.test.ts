import { describe, expect, test } from "bun:test";
import { resolvePolicy } from "../src/policy";
import { createStream } from "../src/stream";
import { createStreamCore, type StreamCoreOptions } from "../src/stream-core";
import type { StreamEvent } from "../src/types";

const { rules, allowlist } = resolvePolicy({
  rules: {
    email: { action: "redact" },
    payment_card: { action: "redact" },
    us_ssn: { action: "redact" },
  },
});

function toChunks(text: string, size: number): string[] {
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }

  return chunks;
}

function runCore(chunks: string[], options: StreamCoreOptions): StreamEvent[] {
  const core = createStreamCore(rules, { allowlist, ...options });
  const events: StreamEvent[] = [];

  for (const chunk of chunks) {
    events.push(...core.push(chunk));
  }

  events.push(...core.finish());

  return events;
}

async function runStream(
  chunks: string[],
  options: StreamCoreOptions,
): Promise<StreamEvent[]> {
  const source = (async function* () {
    yield* chunks;
  })();

  const events: StreamEvent[] = [];

  for await (const event of createStream(() =>
    createStreamCore(rules, { allowlist, ...options }),
  )(source)) {
    events.push(event);
  }

  return events;
}

const inputs: Record<string, string> = {
  plain: "nothing sensitive here, just text",
  mixed:
    "Email alice@example.com, SSN 123-45-6789, card 4111 1111 1111 1111. Done.",
  emoji: "👋🏽 héllo bob@example.org 🇺🇸 ssn 123-45-6789 — ünïcödé 👨‍👩‍👧 end",
  long: `${"padding ".repeat(80)}carol@example.net ${"more ".repeat(80)}`,
};

const chunkSizes = [1, 3, 7, 64, 100_000];

const optionSets: Record<string, StreamCoreOptions> = {
  default: {},
  report: { report: true },
  restore: { restore: true },
  "report+restore": { report: true, restore: true },
  detectOnly: { detectOnly: true, report: true },
};

describe("createStreamCore", () => {
  for (const [inputName, input] of Object.entries(inputs)) {
    for (const [optionName, options] of Object.entries(optionSets)) {
      test(`matches createStream: ${inputName} / ${optionName}`, async () => {
        for (const size of chunkSizes) {
          const chunks = toChunks(input, size);

          expect(runCore(chunks, options)).toEqual(
            await runStream(chunks, options),
          );
        }
      });
    }
  }

  test("finds a match split across pushes", () => {
    const core = createStreamCore(rules, { allowlist, report: true });

    const events = [
      ...core.push("contact ali"),
      ...core.push("ce@exam"),
      ...core.push("ple.com today"),
      ...core.finish(),
    ];

    const detections = events.filter((e) => e.type === "detection");

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      group: { start: 8, end: 25 },
    });
    expect(events.at(-1)).toEqual({ type: "complete" });
  });

  test("finish emits a frozen restoration map when restore is enabled", () => {
    const core = createStreamCore(rules, { allowlist, restore: true });

    core.push("mail alice@example.com");

    const complete = core.finish().at(-1);

    expect(complete?.type).toBe("complete");

    if (complete?.type === "complete") {
      expect(Object.isFrozen(complete.map)).toBe(true);
      expect(Object.values(complete.map ?? {})).toContain("alice@example.com");
    }
  });

  test("detectOnly suppresses the restoration map", () => {
    const core = createStreamCore(rules, {
      allowlist,
      restore: true,
      detectOnly: true,
    });

    core.push("mail alice@example.com");

    expect(core.finish().at(-1)).toEqual({ type: "complete" });
  });

  test("push throws BUFFER_LIMIT when the buffer overflows", () => {
    const { rules: wideRules } = resolvePolicy({
      rules: { email: { action: "redact" } },
    });
    const core = createStreamCore(wideRules);

    expect(() => core.push("x".repeat(70_000))).toThrow(
      expect.objectContaining({ code: "BUFFER_LIMIT" }),
    );
  });
});
