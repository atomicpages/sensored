/**
 * Per-detector fixtures derived from the eval corpus. The files are
 * gitignored; their digests go in the committed manifest.
 */
import { join } from "node:path";
import { parseCorpus } from "../packages/sensored/eval/evaluator";
import { renderCase } from "./reference";
import {
  type DetectorManifest,
  GOLDEN_VERSION,
  type GoldenFile,
  type RenderCase,
} from "./types";

export const CORPUS_PATH = join(
  import.meta.dir,
  "../packages/sensored/eval/corpus.json",
);

const NEGATIVES_PER_RULE = 100;

export interface DetectorFixtures {
  /** File name under `golden/detectors/` to serialized contents. */
  readonly files: ReadonlyMap<string, string>;
  readonly manifest: DetectorManifest;
}

export function sha256(data: string | Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(data).digest("hex");
}

/** `undefined` when the corpus has not been generated. */
export async function buildDetectorFixtures(
  serialize: (value: unknown) => string,
): Promise<DetectorFixtures | undefined> {
  const file = Bun.file(CORPUS_PATH);

  if (!(await file.exists())) {
    return undefined;
  }

  const bytes = await file.bytes();
  const corpus = parseCorpus(JSON.parse(new TextDecoder().decode(bytes)));

  const negatives = corpus.cases
    .filter((row) => row.kind === "negative")
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, NEGATIVES_PER_RULE);

  const files = new Map<string, string>();
  const manifestFiles: Record<string, DetectorManifest["files"][string]> = {};

  for (const rule of [...corpus.rules].sort()) {
    const config = { rules: { [rule]: { action: "redact" as const } } };

    const positives = corpus.cases.filter(
      (row) =>
        row.kind !== "deferred" &&
        row.expected.some((tuple) => tuple.ruleId === rule),
    );

    const cases = [...positives, ...negatives].map(
      (row): RenderCase => renderCase({ id: row.id, config, input: row.text }),
    );

    const golden: GoldenFile<RenderCase> = { version: GOLDEN_VERSION, cases };
    const name = `${rule}.json`;
    const contents = serialize(golden);

    files.set(name, contents);
    manifestFiles[name] = { sha256: sha256(contents), cases: cases.length };
  }

  return {
    files,
    manifest: {
      version: GOLDEN_VERSION,
      corpusFingerprint: sha256(bytes),
      files: manifestFiles,
    },
  };
}
