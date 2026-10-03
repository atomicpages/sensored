import type { RedactorConfig } from "../src/types";

export type ConfigInput =
  | RedactorConfig
  | (() => RedactorConfig | Promise<RedactorConfig>);

export function defineConfig(config: ConfigInput): ConfigInput {
  if (typeof config === "function") {
    return config;
  }

  validateConfigShape(config);

  return config;
}

function validateConfigShape(
  config: unknown,
): asserts config is RedactorConfig {
  if (typeof config !== "object" || config === null) {
    throw new Error(
      "Config must be an object or a function returning an object",
    );
  }

  const obj = config as Record<string, unknown>;

  if ("presets" in obj && obj.presets !== undefined) {
    if (
      !Array.isArray(obj.presets) ||
      obj.presets.some((v) => typeof v !== "string")
    ) {
      throw new Error("Config 'presets' must be an array of strings");
    }
  }

  if ("rules" in obj && obj.rules !== undefined) {
    if (typeof obj.rules !== "object" || obj.rules === null) {
      throw new Error("Config 'rules' must be an object");
    }
  }

  if ("allowlist" in obj && obj.allowlist !== undefined) {
    if (
      !Array.isArray(obj.allowlist) ||
      obj.allowlist.some((v) => typeof v !== "string")
    ) {
      throw new Error("Config 'allowlist' must be an array of strings");
    }
  }

  if (
    "restore" in obj &&
    obj.restore !== undefined &&
    typeof obj.restore !== "boolean"
  ) {
    throw new Error("Config 'restore' must be a boolean");
  }

  if ("detectors" in obj && obj.detectors !== undefined) {
    if (!Array.isArray(obj.detectors)) {
      throw new Error("Config 'detectors' must be an array");
    }
  }

  if ("limits" in obj && obj.limits !== undefined) {
    if (typeof obj.limits !== "object" || obj.limits === null) {
      throw new Error("Config 'limits' must be an object");
    }
  }

  if ("semantic" in obj && obj.semantic !== undefined) {
    if (typeof obj.semantic !== "object" || obj.semantic === null) {
      throw new Error("Config 'semantic' must be an object");
    }
  }
}
