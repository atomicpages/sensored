import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { RedactorConfig } from "../src/types";
import type { ConfigInput } from "./config";

const CONFIG_FILES = [
  "sensored.config.ts",
  "sensored.config.mts",
  "sensored.config.cts",
  "sensored.config.json",
  "sensored.config.jsonc",
];

export function findConfig(cwd: string = process.cwd()): string | undefined {
  let dir = cwd;
  const root = resolve(dir, "/");

  while (true) {
    for (const file of CONFIG_FILES) {
      const candidate = join(dir, file);

      if (existsSync(candidate)) {
        return candidate;
      }
    }

    if (dir === root) {
      break;
    }

    dir = dirname(dir);
  }

  return undefined;
}

export async function loadConfig(path: string): Promise<RedactorConfig> {
  const mod = await import(path);
  const exported = mod.default as ConfigInput | undefined;

  if (exported === undefined) {
    throw new Error(`Config file "${path}" has no default export`);
  }

  if (typeof exported === "function") {
    return await exported();
  }

  return exported;
}

export async function resolveConfig(
  configPath?: string,
  noConfig?: boolean,
): Promise<RedactorConfig | undefined> {
  if (noConfig) {
    return undefined;
  }

  const resolved = configPath ?? findConfig();

  if (resolved === undefined) {
    return undefined;
  }

  return loadConfig(resolved);
}
