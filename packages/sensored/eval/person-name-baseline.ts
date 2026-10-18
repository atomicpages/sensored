/**
 * Records the person-name quality bar for the Rust core rewrite.
 *
 * The corpus labels person names as `person_name_lite`. Both the compromise
 * NER detector (`person_name`) and `person_name_lite` are scored against those
 * spans, with `person_name` matches relabelled so the tuples compare. The Rust
 * rule-based NER must land within 2 F1 points of the compromise numbers.
 *
 * Usage: bun eval/person-name-baseline.ts eval/corpus.json eval/person-name-baseline.json
 */
import { createRedactor, preloadPersonNameDetector } from "../src/index.ts";
import { type Corpus, evaluate, type Metrics, parseCorpus } from "./evaluator.ts";

const LABEL = "person_name_lite";

const [corpusPath, outputPath] = Bun.argv.slice(2);

if (!corpusPath || !outputPath) {
  console.error(
    "Usage: bun eval/person-name-baseline.ts <corpus.json> <output.json>",
  );
  process.exit(2);
}

const full = parseCorpus(await Bun.file(corpusPath).json());

const corpus: Corpus = {
  ...full,
  rules: [LABEL],
  cases: full.cases.map((row) => ({
    ...row,
    expected: row.expected.filter((tuple) => tuple.ruleId === LABEL),
  })),
};

await preloadPersonNameDetector();

async function score(ruleId: string): Promise<Metrics & { f1: number | null }> {
  const redactor = createRedactor({ rules: { [ruleId]: { action: "redact" } } });

  const report = await evaluate(corpus, (text) =>
    redactor
      .inspect(text)
      .groups.flatMap((group) => group.matches)
      .map(({ start, end }) => ({ ruleId: LABEL, start, end })),
  );

  const metrics = report.rules[LABEL];

  if (!metrics) {
    throw new Error(`No metrics for ${LABEL}`);
  }

  const { precision, recall } = metrics;
  const f1 =
    precision === null || recall === null || precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);

  return { ...metrics, f1 };
}

const result = {
  revision: corpus.revision,
  label: LABEL,
  detectors: {
    person_name: await score("person_name"),
    person_name_lite: await score(LABEL),
  },
};

await Bun.write(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result.detectors, null, 2));
