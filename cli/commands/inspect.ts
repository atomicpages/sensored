import { bold, cyan } from "../colors";
import type { CLIOptions } from "../flags";
import { printJSON, printTable } from "../output";
import {
  assertPipeOrFile,
  buildRedactor,
  readInputFile,
  readStdin,
} from "../shared";

export async function inspectCommand(options: CLIOptions): Promise<void> {
  const [inputPath] = options.positional;

  assertPipeOrFile(
    inputPath,
    "pipe text via stdin or provide an input file: sensored inspect <input.txt>",
  );

  const { redactor } = await buildRedactor(options);

  const isPipeMode = inputPath === undefined;
  const text = isPipeMode ? await readStdin() : await readInputFile(inputPath!);

  const inspection = redactor.inspect(text);

  if (options.json) {
    const detections = inspection.groups.flatMap((group) =>
      group.matches.map((match) => ({
        ruleId: match.ruleId,
        entityType: match.entityType,
        value: match.value,
        start: match.start,
        end: match.end,
        replacement: group.replacement,
        reasons: match.reasons,
      })),
    );

    printJSON(detections);
    return;
  }

  const totalDetections = inspection.groups.reduce(
    (sum, group) => sum + group.matches.length,
    0,
  );

  if (totalDetections === 0) {
    process.stdout.write(`${bold("No detections found.")}\n`);
    return;
  }

  const rows = inspection.groups.flatMap((group) =>
    group.matches.map((match) => ({
      ruleId: match.ruleId,
      entityType: match.entityType,
      value:
        match.value.length > 40
          ? match.value.slice(0, 37) + "..."
          : match.value,
      start: String(match.start),
      end: String(match.end),
      replacement: group.replacement,
    })),
  );

  printTable(
    [
      { header: "Rule ID", width: 20, field: "ruleId" },
      { header: "Entity Type", width: 20, field: "entityType" },
      { header: "Value", width: 42, field: "value" },
      { header: "Start", width: 8, field: "start" },
      { header: "End", width: 8, field: "end" },
      { header: "Replacement", width: 15, field: "replacement" },
    ],
    rows,
  );

  process.stderr.write(`\n${cyan("Total:")} ${totalDetections} detection(s)\n`);
}
