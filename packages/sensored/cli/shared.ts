import {
  createRedactor,
  preloadPersonNameDetector,
  type Redactor,
} from "../src/index";
import type { RedactorConfig, RestorationMap, RuleSetting } from "../src/types";
import { printError, printUsageError } from "./errors";
import {
  type CLIOptions,
  loadAllowlistFile,
  mergeConfig,
  parseRuleFlag,
} from "./flags";
import { resolveConfig } from "./load-config";

export async function readStdin(): Promise<string> {
  const chunks: string[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return chunks.join("");
}

export function assertPipeOrFile(inputPath?: string, hint?: string): void {
  if (inputPath === undefined && process.stdin.isTTY === true) {
    printUsageError(
      "no input provided",
      hint ?? "pipe text via stdin or provide an input file",
    );
  }
}

export async function readInputFile(inputPath: string): Promise<string> {
  try {
    return await Bun.file(inputPath).text();
  } catch {
    printError(`failed to read input file: ${inputPath}`);
  }
}

export async function assertWritable(
  outputPath: string,
  force?: boolean,
): Promise<void> {
  const exists = await Bun.file(outputPath).exists();

  if (exists && !force) {
    printUsageError(
      `output file already exists: ${outputPath}`,
      "use --force to overwrite",
    );
  }
}

export async function writeOutput(
  content: string,
  outputPath?: string,
): Promise<void> {
  if (outputPath) {
    await Bun.write(outputPath, content);
  } else {
    process.stdout.write(content);
  }
}

export async function writeRestoreMap(
  map: RestorationMap | undefined,
  mapPath: string,
): Promise<void> {
  await Bun.write(mapPath, `${JSON.stringify(map ?? {}, null, 2)}\n`);
}

export interface BuildRedactorResult {
  readonly redactor: Redactor;
  readonly config: RedactorConfig;
  readonly options: CLIOptions;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function buildRedactor(
  options: CLIOptions,
): Promise<BuildRedactorResult> {
  const rules = new Map<string, RuleSetting | "off">();

  for (const ruleArg of options.rule ?? []) {
    try {
      const parsed = parseRuleFlag(ruleArg);
      rules.set(parsed.id, parsed.setting);
    } catch (err) {
      printUsageError(errorMessage(err));
    }
  }

  let allowlist = [...(options.allowlist ?? [])];

  if (options.allowlistFile) {
    try {
      const fileAllowlist = await loadAllowlistFile(options.allowlistFile);
      allowlist = [...allowlist, ...fileAllowlist];
    } catch {
      printError(`failed to read allowlist file: ${options.allowlistFile}`);
    }
  }

  let baseConfig: RedactorConfig | undefined;

  try {
    baseConfig = await resolveConfig(options.config, options.noConfig ?? false);
  } catch (err) {
    printError(`failed to load config: ${errorMessage(err)}`);
  }

  const semanticApiKey = options.semantic
    ? process.env.TYPESAFE_API_KEY
    : undefined;

  if (options.semantic && !semanticApiKey) {
    printUsageError(
      "--semantic requires TYPESAFE_API_KEY environment variable",
      "set TYPESAFE_API_KEY or remove --semantic",
    );
  }

  const config = mergeConfig(
    baseConfig,
    options,
    rules,
    allowlist,
    semanticApiKey,
  );

  let redactor: Redactor;

  try {
    redactor = createRedactor(config);

    if (redactor.describe().some((detector) => detector.id === "person_name")) {
      await preloadPersonNameDetector();
    }
  } catch (err) {
    printError(`invalid configuration: ${errorMessage(err)}`);
  }

  return { redactor, config, options };
}
