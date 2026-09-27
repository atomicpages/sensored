import { createRedactor } from "../src/index.ts";
import {
  evaluate,
  parseBaseline,
  parseCorpus,
  releaseGate,
} from "./evaluator.ts";

const args = Bun.argv.slice(2);
const configIndex = args.indexOf("--config");
let configPath: string | undefined;
let remainingArgs: string[];

if (configIndex !== -1) {
  configPath = args[configIndex + 1];
  remainingArgs = [...args.slice(0, configIndex), ...args.slice(configIndex + 2)];
} else {
  remainingArgs = args;
}

const [command, corpusPath, outputPath, baselinePath] = remainingArgs;
if (!["score", "gate"].includes(command ?? "") || !corpusPath || !outputPath) {
  console.error(
    "Usage: bun eval/cli.ts [--config <config.json>] <score|gate> <corpus.json> <report.json> [baseline.json]",
  );
  process.exit(2);
}
try {
  if (await Bun.file(outputPath).exists()) {
    throw new Error("Report output must be a new file");
  }
  const corpus = parseCorpus(await Bun.file(corpusPath).json());
  const config = configPath
    ? await Bun.file(configPath).json()
    : {
        rules: Object.fromEntries(
          corpus.rules.map((rule) => [rule, { action: "redact" }]),
        ),
      };

  if (config.semantic && process.env.TYPESAFE_API_KEY) {
    config.semantic.apiKey = process.env.TYPESAFE_API_KEY;
  }

  const redactor = createRedactor(config);
  const hasSemantic = Boolean(config.semantic);

  const report = await evaluate(
    corpus,
    (text) => {
      if (hasSemantic) {
        return redactAsyncToTuples(redactor, text);
      }
      return redactor.inspect(text).groups.flatMap((group) => group.matches);
    },
    (done, total) => {
      process.stderr.write(`\r${done}/${total} cases scored`);
    },
  );
  process.stderr.write("\n");

  const baseline = baselinePath
    ? parseBaseline(await Bun.file(baselinePath).json())
    : undefined;
  const failures = releaseGate(report, baseline);
  await Bun.write(
    outputPath,
    `${JSON.stringify({ ...report, gate: { passed: failures.length === 0, failures } }, null, 2)}\n`,
  );
  console.log(
    `Scored ${report.documents.scored} documents; release gate ${failures.length === 0 ? "passed" : "blocked"}.`,
  );
  if (command === "gate" && failures.length > 0) {
    process.exitCode = 1;
  }
} catch {
  // JSON parser, filesystem, and detector exceptions can contain corpus content.
  console.error(
    "Evaluation failed: verify corpus, baseline, paths, and selected detector configuration. No report is release evidence for this run.",
  );
  process.exitCode = 2;
}

async function redactAsyncToTuples(
  redactor: { redactAsync(text: string): Promise<{ detections: readonly { ruleId: string; start: number; end: number }[] }> },
  text: string,
): Promise<readonly { ruleId: string; start: number; end: number }[]> {
  const result = await redactor.redactAsync(text);
  return result.detections.map((d) => ({
    ruleId: d.ruleId,
    start: d.start,
    end: d.end,
  }));
}
