import { MAX_INPUT_LENGTH, type Redactor } from "../../src/index";
import type { RestorationMap } from "../../src/types";
import { printError, printUsageError } from "../errors";
import type { CLIOptions } from "../flags";
import { printInfo } from "../output";
import {
  assertPipeOrFile,
  assertWritable,
  buildRedactor,
  readInputFile,
  readStdin,
  writeOutput,
  writeRestoreMap,
} from "../shared";

export async function redactCommand(options: CLIOptions): Promise<void> {
  const [inputPath, outputPath] = options.positional;

  assertPipeOrFile(
    inputPath,
    "pipe text via stdin or provide an input file: sensored <input.txt> [output.txt]",
  );

  const isPipeMode = inputPath === undefined;

  if (options.restore && isPipeMode && !options.restoreMap) {
    printUsageError(
      "--restore requires --restore-map in pipe mode",
      "example: echo 'text' | sensored --restore --restore-map map.json",
    );
  }

  if (options.restoreMap && !options.restore) {
    printUsageError("--restore-map requires --restore");
  }

  const { redactor, options: opts } = await buildRedactor(options);

  if (isPipeMode) {
    await runPipe(redactor, opts);
  } else {
    await runFile(redactor, opts, inputPath!, outputPath);
  }
}

async function runPipe(redactor: Redactor, options: CLIOptions): Promise<void> {
  const restoreEnabled = options.restore ?? false;
  const jsonMode = options.json ?? false;

  if (jsonMode) {
    const text = await readStdin();
    const result = await runRedact(
      redactor,
      text,
      restoreEnabled,
      options.semantic ?? false,
    );

    await writeOutput(JSON.stringify(result, null, 2) + "\n");

    if (restoreEnabled && options.restoreMap && result.map) {
      await writeRestoreMap(result.map, options.restoreMap);
    }

    return;
  }

  async function* stdinChunks() {
    for await (const chunk of process.stdin) {
      yield chunk;
    }
  }

  if (restoreEnabled && options.restoreMap) {
    let map: RestorationMap | undefined;

    for await (const event of redactor.stream(stdinChunks(), {
      restore: true,
    })) {
      if (event.type === "text") {
        process.stdout.write(event.text);
      } else if (event.type === "complete" && event.map) {
        map = event.map;
      }
    }

    if (map) {
      await writeRestoreMap(map, options.restoreMap);
    }

    return;
  }

  for await (const event of redactor.stream(stdinChunks(), {
    restore: false,
  })) {
    if (event.type === "text") {
      process.stdout.write(event.text);
    }
  }
}

async function runFile(
  redactor: Redactor,
  options: CLIOptions,
  inputPath: string,
  outputPath: string | undefined,
): Promise<void> {
  const limit = options.maxInputLength ?? MAX_INPUT_LENGTH;

  const text = await readInputFile(inputPath);

  if (text.length > limit) {
    printError(
      `input file is ${text.length} chars, exceeds limit of ${limit}`,
      "use --max-input-length to increase the limit",
    );
  }

  if (outputPath) {
    await assertWritable(outputPath, options.force);
  }

  const restoreEnabled = options.restore ?? false;
  const result = await runRedact(
    redactor,
    text,
    restoreEnabled,
    options.semantic ?? false,
  );

  if (options.json) {
    await writeOutput(JSON.stringify(result, null, 2) + "\n", outputPath);

    if (restoreEnabled && outputPath) {
      const mapPath = options.restoreMap ?? defaultMapPath(outputPath);
      await writeRestoreMap(result.map, mapPath);
      printInfo(`restoration map written to ${mapPath}`);
    }

    return;
  }

  await writeOutput(result.text, outputPath);

  if (restoreEnabled && outputPath) {
    const mapPath = options.restoreMap ?? defaultMapPath(outputPath);
    await writeRestoreMap(result.map, mapPath);
    printInfo(`restoration map written to ${mapPath}`);
  }

  if (outputPath) {
    printInfo(`redacted output written to ${outputPath}`);
  }
}

async function runRedact(
  redactor: Redactor,
  text: string,
  restore: boolean,
  semantic: boolean,
): Promise<{
  text: string;
  detections: readonly unknown[];
  map?: RestorationMap;
}> {
  if (semantic) {
    const result = await redactor.redactAsync(text);

    return {
      text: result.text,
      detections: result.detections,
      ...(result.map ? { map: result.map } : {}),
    };
  }

  if (restore) {
    const result = redactor.redact(text);

    if (typeof result === "string") {
      throw new Error(
        "Expected RedactResult but got string — restore not enabled",
      );
    }

    return {
      text: result.text,
      detections: [],
      map: result.map,
    };
  }

  const redacted = redactor.redact(text);

  if (typeof redacted === "string") {
    return {
      text: redacted,
      detections: [],
    };
  }

  return {
    text: redacted.text,
    detections: [],
    map: redacted.map,
  };
}

function defaultMapPath(outputPath: string): string {
  const dotIndex = outputPath.lastIndexOf(".");

  if (dotIndex > 0) {
    return outputPath.slice(0, dotIndex) + ".map.json";
  }

  return outputPath + ".map.json";
}
