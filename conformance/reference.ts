/**
 * Runs the TS reference engine through its public API and shapes the results
 * into the fixture contract in `types.ts`.
 */
import { SensoredError } from "../packages/sensored/src/errors";
import { resolvePolicy } from "../packages/sensored/src/policy";
import { createRedactor } from "../packages/sensored/src/reference";
import { restore } from "../packages/sensored/src/restore";
import { StreamRestorer } from "../packages/sensored/src/stream-restore";
import type {
  RestorationMap,
  StreamOptions,
} from "../packages/sensored/src/types";
import type {
  ErrorCase,
  JsonRedactorConfig,
  PolicyCase,
  RenderCase,
  RestoreCase,
  StreamCase,
} from "./types";

// ---------------------------------------------------------------------------
// Seed shapes: hand-written inputs, before the reference fills `expected`
// ---------------------------------------------------------------------------

export type RenderSeed = Omit<RenderCase, "expected">;
export type PolicySeed = Omit<PolicyCase, "expected">;
export type ErrorSeed =
  | { readonly id: string; readonly config: unknown }
  | {
      readonly id: string;
      readonly config: JsonRedactorConfig;
      readonly input: string;
    };
export type StreamSeed = Omit<StreamCase, "expected">;
export type RestoreSeed = Omit<RestoreCase, "expected">;

/** A chunking whose normalised stream output differs from one-chunk output. */
export interface Disagreement {
  readonly id: string;
  readonly chunking: string;
  readonly diff: string;
}

/** Round-trips through JSON so `undefined` fields and prototypes are dropped. */
export function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isRestorationMap(value: unknown): value is RestorationMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === "string");
}

// ---------------------------------------------------------------------------
// Complete-string cases
// ---------------------------------------------------------------------------

export function renderCase(seed: RenderSeed): RenderCase {
  const inspection = createRedactor(seed.config).inspect(seed.input);

  // `inspect` carries the restoration map at runtime when `config.restore`.
  const map =
    "map" in inspection && isRestorationMap(inspection.map)
      ? inspection.map
      : undefined;

  return toJson({
    ...seed,
    expected: { text: inspection.text, groups: inspection.groups, map },
  });
}

export function policyCase(seed: PolicySeed): PolicyCase {
  return toJson({
    ...seed,
    expected: { policy: resolvePolicy(seed.config).policy },
  });
}

function captureError(run: () => void, id: string): ErrorCase["expected"] {
  try {
    run();
  } catch (error) {
    if (error instanceof SensoredError) {
      return { code: error.code, path: error.path };
    }

    throw error;
  }

  throw new Error(`Error seed "${id}" was accepted by the reference`);
}

/**
 * Construction errors go through `resolvePolicy`, the validator behind
 * `createRedactor`, because a malformed `config` cannot be typed as one.
 * Input errors come from `inspect` on a valid config.
 */
export function errorCase(seed: ErrorSeed): ErrorCase {
  const expected = captureError(() => {
    if ("input" in seed) {
      createRedactor(seed.config).inspect(seed.input);
    } else {
      resolvePolicy(seed.config);
    }
  }, seed.id);

  return toJson({ ...seed, expected });
}

// ---------------------------------------------------------------------------
// Chunkings
// ---------------------------------------------------------------------------

interface Chunking {
  readonly label: string;
  readonly chunks: readonly string[];
}

/**
 * Every two-chunk split at a code-point boundary (including the empty edges)
 * and one chunk per code point, as `StreamCase` and `RestoreCase` require.
 */
function chunkings(input: string): Chunking[] {
  const points = Array.from(input);
  const result: Chunking[] = [];

  for (let i = 0; i <= points.length; i++) {
    result.push({
      label: `split@${i}`,
      chunks: [points.slice(0, i).join(""), points.slice(i).join("")],
    });
  }

  result.push({ label: "per-code-point", chunks: points });

  return result;
}

function describeDiff(expected: unknown, actual: unknown): string {
  const want = JSON.stringify(expected);
  const got = JSON.stringify(actual);

  let at = 0;

  while (at < want.length && want[at] === got[at]) {
    at++;
  }

  const from = Math.max(0, at - 20);

  return `at char ${at}: expected …${want.slice(from, at + 40)}… got …${got.slice(from, at + 40)}…`;
}

async function verifyChunkings<T>(
  id: string,
  input: string,
  run: (chunks: readonly string[]) => Promise<T> | T,
  disagreements: Disagreement[],
): Promise<T | undefined> {
  const reference = toJson(await run([input]));
  const expected = JSON.stringify(reference);

  let agrees = true;

  for (const { label, chunks } of chunkings(input)) {
    const actual = toJson(await run(chunks));

    if (JSON.stringify(actual) !== expected) {
      agrees = false;
      disagreements.push({
        id,
        chunking: label,
        diff: describeDiff(reference, actual),
      });
    }
  }

  return agrees ? reference : undefined;
}

// ---------------------------------------------------------------------------
// Streaming cases
// ---------------------------------------------------------------------------

async function* fromChunks(chunks: readonly string[]): AsyncIterable<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function runStream(
  config: JsonRedactorConfig,
  options: StreamOptions,
  chunks: readonly string[],
): Promise<StreamCase["expected"]> {
  const redactor = createRedactor(config);

  let text = "";
  const detections: StreamCase["expected"]["detections"][number][] = [];
  let map: RestorationMap | undefined;

  for await (const event of redactor.stream(fromChunks(chunks), options)) {
    if (event.type === "text") {
      text += event.text;
    }

    if (event.type === "detection") {
      detections.push(event.group);
    }

    if (event.type === "complete") {
      map = event.map;
    }
  }

  return { text, detections, map };
}

/** `undefined` when some chunking disagrees; the reasons land in `disagreements`. */
export async function streamCase(
  seed: StreamSeed,
  disagreements: Disagreement[],
): Promise<StreamCase | undefined> {
  const expected = await verifyChunkings(
    seed.id,
    seed.input,
    (chunks) => runStream(seed.config, seed.options, chunks),
    disagreements,
  );

  return expected === undefined ? undefined : toJson({ ...seed, expected });
}

function runRestorer(map: RestorationMap, chunks: readonly string[]): string {
  const restorer = new StreamRestorer(map);

  return (
    chunks.map((chunk) => restorer.push(chunk)).join("") + restorer.flush()
  );
}

/**
 * A streamed seed whose `StreamRestorer` output disagrees at some chunking is
 * kept as `streamed: false`: `restore()` is still pinned, the streaming claim
 * is dropped, and the reasons land in `disagreements`.
 */
export async function restoreCase(
  seed: RestoreSeed,
  disagreements: Disagreement[],
): Promise<RestoreCase> {
  const expected = restore(seed.input, seed.map);

  if (!seed.streamed) {
    return toJson({ ...seed, expected });
  }

  const streamed = await verifyChunkings(
    seed.id,
    seed.input,
    (chunks) => runRestorer(seed.map, chunks),
    disagreements,
  );

  if (streamed !== undefined && streamed !== expected) {
    disagreements.push({
      id: seed.id,
      chunking: "one-chunk vs restore()",
      diff: describeDiff(expected, streamed),
    });
  }

  return toJson({ ...seed, streamed: streamed === expected, expected });
}
