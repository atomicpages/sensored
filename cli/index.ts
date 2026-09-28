#!/usr/bin/env bun

import { defineCommand, runCommand, showUsage } from "citty";
import pkg from "../package.json" with { type: "json" };
import { inspectCommand } from "./commands/inspect";
import { listDetectorsCommand } from "./commands/list-detectors";
import { listPresetsCommand } from "./commands/list-presets";
import { redactCommand } from "./commands/redact";
import { restoreCommand } from "./commands/restore";
import { CLIError } from "./errors";
import type { CLIOptions } from "./flags";

const VERSION = pkg.version;

const SUBCOMMANDS = new Set([
  "redact",
  "inspect",
  "restore",
  "list-detectors",
  "list-presets",
]);

/** Extract repeated string flags from args. Returns [values, remaining]. */
function extractRepeated(
  args: readonly string[],
  flag: string,
): [string[], string[]] {
  const values: string[] = [];
  const remaining: string[] = [];
  const longFlag = `--${flag}`;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === longFlag) {
      if (i + 1 < args.length) {
        values.push(args[i + 1]!);
        i++;
      }
    } else if (arg.startsWith(`${longFlag}=`)) {
      values.push(arg.slice(longFlag.length + 1));
    } else {
      remaining.push(arg);
    }
  }

  return [values, remaining];
}

/** Extract a boolean flag (presence-based). Returns [present, remaining]. */
function extractBoolean(
  args: readonly string[],
  flag: string,
): [boolean, string[]] {
  const longFlag = `--${flag}`;
  const remaining: string[] = [];
  let present = false;

  for (const arg of args) {
    if (arg === longFlag) {
      present = true;
    } else {
      remaining.push(arg);
    }
  }

  return [present, remaining];
}

/** Flags that consume the next argument as their value. */
const VALUE_FLAGS = new Set([
  "--rule",
  "--allowlist",
  "--config",
  "--allowlist-file",
  "--restore-map",
  "--preset",
  "--max-input-length",
  "--map",
]);

/** Find the index of the first non-flag argument. */
function findFirstPositional(args: readonly string[]): number {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "--") return -1;

    if (arg.startsWith("-")) {
      if (VALUE_FLAGS.has(arg) && i + 1 < args.length) {
        i++;
      }

      continue;
    }

    return i;
  }

  return -1;
}

// ---- Command definitions ----

const redactCmd = defineCommand({
  meta: {
    name: "sensored",
    version: VERSION,
    description: "Streaming-first PII redaction for TypeScript",
  },
  args: {
    input: {
      type: "positional",
      description: "Input file path (reads from stdin if omitted)",
      required: false,
    },
    output: {
      type: "positional",
      description: "Output file path (writes to stdout if omitted)",
      required: false,
    },
    preset: {
      type: "string",
      description: "Preset rule set to apply",
      valueHint: "name",
    },
    allowlistFile: {
      type: "string",
      description: "Path to file containing allowlist values (one per line)",
      valueHint: "path",
    },
    restore: {
      type: "boolean",
      description: "Enable restoration map generation",
    },
    restoreMap: {
      type: "string",
      description:
        "Path for restoration map file (required with --restore in pipe mode)",
      valueHint: "path",
    },
    semantic: {
      type: "boolean",
      description: "Enable semantic confirmation (requires TYPESAFE_API_KEY)",
    },
    maxInputLength: {
      type: "string",
      description: "Maximum input length in characters",
      valueHint: "n",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing output files",
    },
    json: {
      type: "boolean",
      description: "Output as JSON with detections and map",
    },
    config: {
      type: "string",
      description: "Path to config file",
      valueHint: "path",
    },
  },
  run: (ctx) => {
    const positional: string[] = [];

    if (ctx.args.input) {
      positional.push(ctx.args.input);
    }

    if (ctx.args.output) {
      positional.push(ctx.args.output);
    }

    const options: CLIOptions = {
      positional,
      preset: ctx.args.preset,
      rule: ctx.data?.rules as string[] | undefined,
      allowlist: ctx.data?.allowlist as string[] | undefined,
      allowlistFile: ctx.args.allowlistFile,
      restore: ctx.args.restore,
      noRestore: ctx.data?.noRestore as boolean | undefined,
      restoreMap: ctx.args.restoreMap,
      semantic: ctx.args.semantic,
      maxInputLength: ctx.args.maxInputLength
        ? Number(ctx.args.maxInputLength)
        : undefined,
      force: ctx.args.force,
      json: ctx.args.json,
      config: ctx.args.config,
      noConfig: ctx.data?.noConfig as boolean | undefined,
    };

    return redactCommand(options);
  },
});

const inspectCmd = defineCommand({
  meta: {
    name: "sensored inspect",
    description: "Inspect text for PII detections without redacting",
  },
  args: {
    input: {
      type: "positional",
      description: "Input file path (reads from stdin if omitted)",
      required: false,
    },
    preset: {
      type: "string",
      description: "Preset rule set to apply",
      valueHint: "name",
    },
    allowlistFile: {
      type: "string",
      description: "Path to file containing allowlist values (one per line)",
      valueHint: "path",
    },
    json: {
      type: "boolean",
      description: "Output as JSON array",
    },
    config: {
      type: "string",
      description: "Path to config file",
      valueHint: "path",
    },
  },
  run: (ctx) => {
    const positional: string[] = [];

    if (ctx.args.input) {
      positional.push(ctx.args.input);
    }

    const options: CLIOptions = {
      positional,
      preset: ctx.args.preset,
      rule: ctx.data?.rules as string[] | undefined,
      allowlist: ctx.data?.allowlist as string[] | undefined,
      allowlistFile: ctx.args.allowlistFile,
      config: ctx.args.config,
      noConfig: ctx.data?.noConfig as boolean | undefined,
      json: ctx.args.json,
    };

    return inspectCommand(options);
  },
});

const restoreCmd = defineCommand({
  meta: {
    name: "sensored restore",
    description: "Restore redacted text using a restoration map",
  },
  args: {
    input: {
      type: "positional",
      description: "Input file path (reads from stdin if omitted)",
      required: false,
    },
    mapPath: {
      type: "positional",
      description: "Path to restoration map file (or use --map)",
      required: false,
    },
    output: {
      type: "positional",
      description: "Output file path (writes to stdout if omitted)",
      required: false,
    },
    map: {
      type: "string",
      description: "Path to restoration map file (overrides positional)",
      valueHint: "path",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing output files",
    },
  },
  run: (ctx) => {
    const positional: string[] = [];

    if (ctx.args.input) {
      positional.push(ctx.args.input);
    }

    if (ctx.args.mapPath) {
      positional.push(ctx.args.mapPath);
    }

    if (ctx.args.output) {
      positional.push(ctx.args.output);
    }

    return restoreCommand({
      positional,
      map: ctx.args.map,
      force: ctx.args.force,
    });
  },
});

const listDetectorsCmd = defineCommand({
  meta: {
    name: "sensored list-detectors",
    description: "List all built-in detectors",
  },
  args: {
    json: {
      type: "boolean",
      description: "Output as JSON array",
    },
  },
  run: (ctx) => {
    return listDetectorsCommand({ json: ctx.args.json });
  },
});

const listPresetsCmd = defineCommand({
  meta: {
    name: "sensored list-presets",
    description: "List all built-in presets",
  },
  args: {
    json: {
      type: "boolean",
      description: "Output as JSON array",
    },
  },
  run: (ctx) => {
    return listPresetsCommand({ json: ctx.args.json });
  },
});

const commands = {
  redact: redactCmd,
  inspect: inspectCmd,
  restore: restoreCmd,
  "list-detectors": listDetectorsCmd,
  "list-presets": listPresetsCmd,
} as const;

type AnyCmd = (typeof commands)[keyof typeof commands];

// ---- Main dispatch ----

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  if (
    rawArgs.length === 1 &&
    (rawArgs[0] === "--version" || rawArgs[0] === "-v")
  ) {
    process.stdout.write(`${VERSION}\n`);
    process.exit(0);
  }

  const firstPos = findFirstPositional(rawArgs);
  const subName = firstPos >= 0 ? rawArgs[firstPos] : undefined;
  const isSubCommand = subName !== undefined && SUBCOMMANDS.has(subName);

  let cmd: AnyCmd;
  let args: string[];

  if (isSubCommand && subName) {
    args = [...rawArgs.slice(0, firstPos), ...rawArgs.slice(firstPos + 1)];
    cmd = commands[subName as keyof typeof commands];
  } else {
    args = [...rawArgs];
    cmd = redactCmd;
  }

  const [noConfig, withoutNoConfig] = extractBoolean(args, "no-config");
  args = withoutNoConfig;

  const [noRestore, withoutNoRestore] = extractBoolean(args, "no-restore");
  args = withoutNoRestore;

  const data: Record<string, unknown> = { noConfig, noRestore };

  if (!isSubCommand || subName === "redact" || subName === "inspect") {
    const [rules, withoutRules] = extractRepeated(args, "rule");
    const [allowlist, withoutAllowlist] = extractRepeated(
      withoutRules,
      "allowlist",
    );
    args = withoutAllowlist;
    data.rules = rules;
    data.allowlist = allowlist;
  }

  if (args.includes("--help") || args.includes("-h")) {
    await showUsage(cmd as typeof redactCmd);
    process.exit(0);
  }

  try {
    await runCommand(cmd as typeof redactCmd, { rawArgs: args, data });
  } catch (error) {
    if (error instanceof CLIError) {
      process.stderr.write(`sensored: ${error.message}\n`);

      if (error.hint) {
        process.stderr.write(`  hint: ${error.hint}\n`);
      }

      process.exit(error.exitCode);
    }

    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`sensored: ${message}\n`);
    process.exit(1);
  }
}

await main();
