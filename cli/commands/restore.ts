import { restore } from "../../src/restore";
import type { RestorationMap } from "../../src/types";
import { printError, printUsageError } from "../errors";
import { printInfo } from "../output";
import {
  assertPipeOrFile,
  assertWritable,
  readInputFile,
  readStdin,
  writeOutput,
} from "../shared";

export interface RestoreArgs {
  positional: string[];
  map?: string;
  force?: boolean;
}

export async function restoreCommand(args: RestoreArgs): Promise<void> {
  let inputPath: string | undefined;
  let mapFile: string | undefined;
  let outputPath: string | undefined;

  if (args.map) {
    [inputPath, outputPath] = args.positional ?? [];
    mapFile = args.map;
  } else {
    [inputPath, mapFile, outputPath] = args.positional ?? [];
  }

  if (!mapFile) {
    printUsageError(
      "--map is required",
      "example: sensored restore redacted.txt --map map.json",
    );
  }

  assertPipeOrFile(
    inputPath,
    "pipe text via stdin or provide an input file: sensored restore <input.txt> --map map.json",
  );

  const mapContent = await readInputFile(mapFile!);

  let restorationMap: RestorationMap;

  try {
    restorationMap = JSON.parse(mapContent);
  } catch {
    printError(`invalid JSON in map file: ${mapFile}`);
  }

  const isPipeMode = inputPath === undefined;
  const text = isPipeMode ? await readStdin() : await readInputFile(inputPath!);

  const restored = restore(text, restorationMap);

  if (outputPath) {
    await assertWritable(outputPath, args.force);
    await writeOutput(restored, outputPath);
    printInfo(`restored output written to ${outputPath}`);
  } else {
    await writeOutput(restored);
  }
}
