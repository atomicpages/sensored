import { faker } from "@faker-js/faker";
import { paymentCardDetector } from "../src/detectors/financial/payment-card";
import { ssnDetector } from "../src/detectors/national-id/ssn";
import { detectAndRender, processText } from "../src/engine";
import { graphemeBoundaries } from "../src/grapheme";
import type { ActiveRule } from "../src/types";

export async function* prototypeStream(
  rules: readonly ActiveRule[],
  chunks: AsyncIterable<string>,
): AsyncGenerator<string> {
  let buffer = "";
  let consumedCursor = 0;

  const maxLeftContext = Math.max(
    0,
    ...rules.map((r) => r.detector.stream?.leftContext ?? 0),
  );

  for await (const chunk of chunks) {
    buffer += chunk;

    let flushPoint = buffer.length;

    for (const rule of rules) {
      const stream = rule.detector.stream;

      if (!stream) {
        continue;
      }

      const safeBoundary =
        buffer.length -
        stream.maxMatchLength -
        Math.max(stream.leftContext, stream.rightContext) -
        stream.boundaryLookaround;

      flushPoint = Math.min(flushPoint, safeBoundary);
    }

    if (flushPoint <= 0) {
      continue;
    }

    const boundaries = graphemeBoundaries(buffer);

    while (flushPoint > 0 && !boundaries.has(flushPoint)) {
      flushPoint--;
    }

    if (flushPoint <= 0) {
      continue;
    }

    const { segments, consumed } = detectAndRender(
      buffer,
      rules,
      flushPoint,
      false,
      consumedCursor,
    );

    if (consumed <= consumedCursor) {
      continue;
    }

    yield segments.map((s) => s.text).join("");

    consumedCursor = consumed;

    if (consumedCursor > maxLeftContext) {
      const trimPoint = consumedCursor - maxLeftContext;
      buffer = buffer.slice(trimPoint);
      consumedCursor -= trimPoint;
    }
  }

  if (buffer.length > 0) {
    const { segments } = detectAndRender(
      buffer,
      rules,
      buffer.length,
      false,
      consumedCursor,
    );
    yield segments.map((s) => s.text).join("");
  }
}

// ---------------------------------------------------------------------------
// Demo: stream realistic text through the prototype
// ---------------------------------------------------------------------------

const rules: ActiveRule[] = [
  { detector: ssnDetector, setting: { action: "redact" } },
  { detector: paymentCardDetector, setting: { action: "redact" } },
];

function generateSample(): string {
  const lines: string[] = [];

  for (let i = 0; i < 20; i++) {
    const sentence = faker.lorem.sentence({ min: 5, max: 12 });

    // Sprinkle PII into roughly half the lines.
    if (i % 2 === 0) {
      const ssn = `${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(4)}`;
      lines.push(`Record ${i + 1}: SSN: ${ssn}. ${sentence}`);
    } else {
      const card = `${faker.string.numeric(4)} ${faker.string.numeric(4)} ${faker.string.numeric(4)} ${faker.string.numeric(4)}`;
      lines.push(`Record ${i + 1}: Card: ${card}. ${sentence}`);
    }
  }

  return lines.join("\n");
}

async function* toChunks(text: string, size: number): AsyncIterable<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}

async function run() {
  const sample = generateSample();

  console.log("=== INPUT (first 300 chars) ===");
  console.log(sample.slice(0, 300));
  console.log("...\n");

  // Complete-string reference
  const reference = processText(sample, rules, false).text;

  // Test multiple chunk sizes
  for (const chunkSize of [1, 16, 64, 256, 1024]) {
    let streamOutput = "";
    let chunkIndex = 0;

    for await (const piece of prototypeStream(
      rules,
      toChunks(sample, chunkSize),
    )) {
      chunkIndex++;
      if (chunkSize === 64) {
        console.log(`[chunk ${chunkIndex}] ${JSON.stringify(piece)}`);
      }
      streamOutput += piece;
    }

    const match = streamOutput === reference;
    console.log(
      `chunkSize=${String(chunkSize).padStart(4)}: ${chunkIndex} chunks, match=${match}`,
    );

    if (!match) {
      for (
        let i = 0;
        i < Math.max(streamOutput.length, reference.length);
        i++
      ) {
        if (streamOutput[i] !== reference[i]) {
          console.log(
            `  First diff at index ${i}: stream=${JSON.stringify(streamOutput.slice(Math.max(0, i - 10), i + 10))} reference=${JSON.stringify(reference.slice(Math.max(0, i - 10), i + 10))}`,
          );
          break;
        }
      }
    }
  }

  // Show sample redactions
  console.log(`\n=== SAMPLE REDACTIONS ===`);
  const redacted = processText(sample, rules, false).text;
  const lines = redacted.split("\n").slice(0, 6);
  for (const line of lines) {
    console.log(line);
  }
}

run();
