// The committed golden fixtures (`conformance/golden/`) through both engines.
// Wasm must match napi exactly: same keys, values and key order (`sameAs`).
// Both are then held to the TS reference's `expected`.
import { describe, expect, test } from "bun:test";

import type {
  ErrorCase,
  GoldenFile,
  RenderCase,
  StreamCase,
} from "../../../conformance/types";
import type {
  NativeBinding,
  NativeInspectionGroup,
  NativeStreamEvent,
} from "../../../packages/sensored/src/native/binding";
import { napi, wasm } from "./engines";

const golden = new URL("../../../conformance/golden/", import.meta.url);

async function load<Case>(file: string): Promise<readonly Case[]> {
  const parsed: GoldenFile<Case> = await Bun.file(new URL(file, golden)).json();

  return parsed.cases;
}

/** Strict equality plus key order, which `toStrictEqual` ignores. */
function sameAs(actual: unknown, expected: unknown, id: string): void {
  expect(actual, id).toStrictEqual(expected);
  expect(JSON.stringify(actual), id).toBe(JSON.stringify(expected));
}

function outcome(fn: () => unknown): unknown {
  try {
    return { ok: fn() };
  } catch (error) {
    if (error instanceof Error) {
      const code: unknown = Reflect.get(error, "code");
      const path: unknown = Reflect.get(error, "path");

      return { error: { message: error.message, code, path } };
    }

    throw error;
  }
}

describe.each(["render.json", "offsets.json", "presets.json"])("%s", (file) => {
  test("inspect matches napi and the reference", async () => {
    for (const { id, config, input, expected } of await load<RenderCase>(
      file,
    )) {
      const run = (engine: NativeBinding) =>
        outcome(() =>
          engine.Redactor.create(JSON.stringify(config)).inspect(input),
        );

      const actual = run(wasm);

      sameAs(actual, run(napi), id);

      expect(actual, id).toEqual({ ok: expected });
    }
  });
});

/** Config the TS wrapper strips before it reaches the core. */
const TS_ONLY_ERROR_CASES = new Set(["invalid-config/semantic/empty"]);

test("errors.json: codes and paths match napi and the reference", async () => {
  for (const { id, config, input, expected } of await load<ErrorCase>(
    "errors.json",
  )) {
    const run = (engine: NativeBinding) =>
      outcome(() => {
        const redactor = engine.Redactor.create(JSON.stringify(config));

        return input === undefined ? undefined : redactor.redact(input);
      });

    const actual = run(wasm);

    sameAs(actual, run(napi), id);
    if (!TS_ONLY_ERROR_CASES.has(id)) {
      expect(actual, id).toMatchObject({ error: expected });
    }
  }
});

/** `input` in two chunks at every code-point boundary, and per code point. */
function chunkings(input: string): string[][] {
  const points = [...input];
  const splits = points.map((_, i) => [
    points.slice(0, i).join(""),
    points.slice(i).join(""),
  ]);

  return [...splits, points];
}

function streamed(
  engine: NativeBinding,
  { config, options }: StreamCase,
  chunks: string[],
): NativeStreamEvent[] {
  const stream = engine.Redactor.create(JSON.stringify(config)).stream(
    options.report,
    options.restore,
  );

  return [...chunks.flatMap((chunk) => stream.push(chunk)), ...stream.finish()];
}

function normalise(events: NativeStreamEvent[]): StreamCase["expected"] {
  let text = "";
  const detections: NativeInspectionGroup[] = [];
  let map: Record<string, string> | undefined;

  for (const event of events) {
    if (event.type === "text") {
      text += event.text;
    } else if (event.type === "detection") {
      detections.push(event.group);
    } else {
      map = event.map;
    }
  }

  return map === undefined ? { text, detections } : { text, detections, map };
}

test("stream.json: every chunking matches napi and the reference", async () => {
  for (const testCase of await load<StreamCase>("stream.json")) {
    const { id, expected } = testCase;

    for (const chunks of chunkings(testCase.input)) {
      const events = streamed(wasm, testCase, chunks);

      sameAs(events, streamed(napi, testCase, chunks), id);

      expect(normalise(events), id).toEqual(expected);
    }
  }
});
