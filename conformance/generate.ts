/**
 * Writes the golden fixtures from the TS reference engine.
 *
 *   bun conformance/generate.ts          regenerate golden/
 *   bun conformance/generate.ts --check  exit 1 if golden/ is stale
 */
import { mkdir, readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { buildDetectorFixtures, type DetectorFixtures } from "./detectors";
import {
  type Disagreement,
  errorCase,
  policyCase,
  type RenderSeed,
  type RestoreSeed,
  renderCase,
  restoreCase,
  streamCase,
} from "./reference";
import { errorSeeds } from "./seeds/errors";
import { offsetSeeds } from "./seeds/offsets";
import { policySeeds } from "./seeds/policy";
import { presetSeeds } from "./seeds/presets";
import { renderSeeds } from "./seeds/render";
import { restoreSeeds } from "./seeds/restore";
import { streamSeeds } from "./seeds/stream";
import {
  GOLDEN_VERSION,
  type GoldenFile,
  type GoldenFiles,
  type RenderCase,
} from "./types";

const GOLDEN_DIR = join(import.meta.dir, "golden");
const DETECTORS_DIR = join(GOLDEN_DIR, "detectors");
const MANIFEST_NAME = "detectors.manifest.json";

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function golden<Case extends { readonly id: string }>(
  file: string,
  cases: readonly (Case | undefined)[],
): GoldenFile<Case> {
  const kept = cases.filter((entry): entry is Case => entry !== undefined);
  const ids = new Set<string>();

  for (const { id } of kept) {
    if (ids.has(id)) {
      throw new Error(`Duplicate case id "${id}" in ${file}`);
    }

    ids.add(id);
  }

  return { version: GOLDEN_VERSION, cases: kept };
}

/** Restore cases for every render case that produced a restoration map. */
function restoreSeedsFromRender(cases: readonly RenderCase[]): RestoreSeed[] {
  return cases.flatMap(({ id, expected }) => {
    if (expected.map === undefined) {
      return [];
    }

    return [
      {
        id: `from-render/${id}`,
        input: expected.text,
        map: expected.map,
        streamed: true,
      },
    ];
  });
}

async function buildCommittedFiles(
  disagreements: Disagreement[],
): Promise<GoldenFiles> {
  const render = renderSeeds.map((seed: RenderSeed) => renderCase(seed));

  const stream = [];

  for (const seed of streamSeeds) {
    stream.push(await streamCase(seed, disagreements));
  }

  const restore = [];

  for (const seed of [...restoreSeedsFromRender(render), ...restoreSeeds]) {
    restore.push(await restoreCase(seed, disagreements));
  }

  return {
    "render.json": golden("render.json", render),
    "offsets.json": golden("offsets.json", offsetSeeds.map(renderCase)),
    "presets.json": golden("presets.json", presetSeeds.map(renderCase)),
    "policy.json": golden("policy.json", policySeeds.map(policyCase)),
    "errors.json": golden("errors.json", errorSeeds.map(errorCase)),
    "stream.json": golden("stream.json", stream),
    "restore.json": golden("restore.json", restore),
  };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

async function readText(path: string): Promise<string | undefined> {
  const file = Bun.file(path);

  return (await file.exists()) ? file.text() : undefined;
}

/** Entries keyed by case id, or by file name for the detector manifest. */
function caseIds(contents: string): Map<string, string> {
  const parsed: unknown = JSON.parse(contents);
  const ids = new Map<string, string>();

  if (typeof parsed !== "object" || parsed === null) {
    return ids;
  }

  if ("files" in parsed && typeof parsed.files === "object" && parsed.files) {
    for (const [name, entry] of Object.entries(parsed.files)) {
      ids.set(name, JSON.stringify(entry));
    }
  }

  if ("cases" in parsed && Array.isArray(parsed.cases)) {
    for (const entry of parsed.cases) {
      if (typeof entry === "object" && entry !== null && "id" in entry) {
        ids.set(String(entry.id), JSON.stringify(entry));
      }
    }
  }

  return ids;
}

/** Case ids added, removed or changed between two serialized golden files. */
function describeStale(onDisk: string | undefined, fresh: string): string {
  if (onDisk === undefined) {
    return "missing";
  }

  const before = caseIds(onDisk);
  const after = caseIds(fresh);
  const changes: string[] = [];

  for (const [id, value] of after) {
    const old = before.get(id);

    if (old === undefined) {
      changes.push(`+${id}`);
    } else if (old !== value) {
      changes.push(`~${id}`);
    }
  }

  for (const id of before.keys()) {
    if (!after.has(id)) {
      changes.push(`-${id}`);
    }
  }

  return changes.length > 0 ? changes.join(", ") : "format or order differs";
}

async function staleFiles(
  expected: ReadonlyMap<string, string>,
): Promise<string[]> {
  const stale: string[] = [];

  for (const [path, contents] of expected) {
    const onDisk = await readText(path);

    if (onDisk !== contents) {
      stale.push(
        `${relative(process.cwd(), path)}: ${describeStale(onDisk, contents)}`,
      );
    }
  }

  return stale;
}

async function writeDetectorFiles(fixtures: DetectorFixtures): Promise<void> {
  await mkdir(DETECTORS_DIR, { recursive: true });

  for (const name of await readdir(DETECTORS_DIR)) {
    if (name.endsWith(".json") && !fixtures.files.has(name)) {
      await rm(join(DETECTORS_DIR, name));
    }
  }

  for (const [name, contents] of fixtures.files) {
    await Bun.write(join(DETECTORS_DIR, name), contents);
  }
}

function reportDisagreements(disagreements: readonly Disagreement[]): void {
  if (disagreements.length === 0) {
    return;
  }

  const byCase = Map.groupBy(disagreements, ({ id }) => id);

  console.error(
    `Chunking disagreements in ${byCase.size} case(s). Stream cases were excluded; restore cases were kept as streamed: false.`,
  );

  for (const [id, entries] of byCase) {
    const chunkings = entries.map(({ chunking }) => chunking).join(", ");

    console.error(`  ${id} [${chunkings}]`);
    console.error(`    first: ${entries[0]?.diff}`);
  }
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  const disagreements: Disagreement[] = [];

  const committed = await buildCommittedFiles(disagreements);
  const detectors = await buildDetectorFixtures(serialize);

  reportDisagreements(disagreements);

  const expected = new Map<string, string>(
    Object.entries(committed).map(([name, file]) => [
      join(GOLDEN_DIR, name),
      serialize(file),
    ]),
  );

  if (detectors === undefined) {
    console.error(
      "Notice: eval/corpus.json not found; skipping per-detector fixtures. Run `bun run eval:generate` in packages/sensored.",
    );
  } else {
    expected.set(
      join(GOLDEN_DIR, MANIFEST_NAME),
      serialize(detectors.manifest),
    );
  }

  if (!check) {
    await mkdir(GOLDEN_DIR, { recursive: true });

    for (const [path, contents] of expected) {
      await Bun.write(path, contents);
    }

    if (detectors !== undefined) {
      await writeDetectorFiles(detectors);
    }

    console.log(
      `Wrote ${expected.size} golden file(s) to ${relative(process.cwd(), GOLDEN_DIR)}`,
    );

    return;
  }

  const stale = await staleFiles(expected);

  // The manifest above already pins every detector file; local copies are
  // compared too when present, so a stale working tree is caught early.
  if (detectors !== undefined) {
    const local = new Map<string, string>();

    for (const [name, contents] of detectors.files) {
      const path = join(DETECTORS_DIR, name);

      if (await Bun.file(path).exists()) {
        local.set(path, contents);
      }
    }

    if (local.size < detectors.files.size) {
      console.error(
        `Notice: ${detectors.files.size - local.size} per-detector file(s) not generated locally; checked via the manifest only.`,
      );
    }

    stale.push(...(await staleFiles(local)));
  }

  if (stale.length > 0) {
    console.error(
      "Golden fixtures are stale. Run `bun run conformance:generate`.",
    );

    for (const line of stale) {
      console.error(`  ${line}`);
    }

    process.exit(1);
  }

  console.log("Golden fixtures are up to date.");
}

await main();
