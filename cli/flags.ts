import type { RedactorConfig, RuleSetting } from "../src/types";

export type RuleAction =
  | "redact"
  | "mask"
  | "remove"
  | "format-preserve"
  | "token-replace"
  | "off";

const ACTION_TO_RULE: Record<string, RuleSetting> = {
  redact: { action: "redact" },
  mask: { action: "mask" },
  remove: { action: "remove" },
  "format-preserve": { action: "format-preserve" },
  "token-replace": { action: "token-replace" },
};

export function parseRuleFlag(value: string): {
  id: string;
  setting: RuleSetting | "off";
} {
  const colonIndex = value.indexOf(":");

  if (colonIndex === -1) {
    throw new Error(
      `Invalid rule "${value}": expected format <id>:<action> (e.g. email:redact)`,
    );
  }

  const id = value.slice(0, colonIndex);
  const action = value.slice(colonIndex + 1);

  if (!id) {
    throw new Error(`Invalid rule "${value}": missing rule ID`);
  }

  if (action === "off") {
    return { id, setting: "off" };
  }

  const rule = ACTION_TO_RULE[action];

  if (!rule) {
    throw new Error(
      `Invalid rule "${value}": unknown action "${action}". Valid actions: redact, mask, remove, format-preserve, token-replace, off`,
    );
  }

  return { id, setting: rule };
}

export interface CLIOptions {
  readonly positional: readonly string[];
  readonly preset?: string;
  readonly rule?: string[];
  readonly allowlist?: string[];
  readonly allowlistFile?: string;
  readonly config?: string;
  readonly noConfig?: boolean;
  readonly json?: boolean;
  readonly restore?: boolean;
  readonly noRestore?: boolean;
  readonly restoreMap?: string;
  readonly semantic?: boolean;
  readonly maxInputLength?: number;
  readonly force?: boolean;
}

export function mergeConfig(
  base: RedactorConfig | undefined,
  options: CLIOptions,
  rules: ReadonlyMap<string, RuleSetting | "off">,
  allowlist: readonly string[],
  semanticApiKey?: string,
): RedactorConfig {
  const presets = [
    ...(base?.presets ?? []),
    ...(options.preset ? [options.preset] : []),
  ];

  const mergedRules: Record<string, RuleSetting | "off"> = {
    ...(base?.rules ?? {}),
  };

  for (const [id, setting] of rules) {
    mergedRules[id] = setting;
  }

  const mergedAllowlist = [...(base?.allowlist ?? []), ...allowlist];

  const config: RedactorConfig = {
    ...base,
    presets: presets.length > 0 ? presets : base?.presets,
    rules: mergedRules,
    allowlist: mergedAllowlist,
    ...(options.noRestore ? { restore: false } : {}),
    ...(options.restore ? { restore: true } : {}),
    ...(options.semantic
      ? {
          semantic: {
            provider: "jev" as const,
            apiKey: semanticApiKey ?? "",
          },
        }
      : {}),
    ...(options.maxInputLength !== undefined
      ? {
          limits: {
            ...base?.limits,
            maxInputLength: options.maxInputLength,
          },
        }
      : {}),
  };

  return config;
}

export async function loadAllowlistFile(path: string): Promise<string[]> {
  const content = await Bun.file(path).text();

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
