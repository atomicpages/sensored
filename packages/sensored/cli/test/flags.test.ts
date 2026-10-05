import { describe, expect, it } from "bun:test";
import { writeFileSync } from "node:fs";
import type { RedactorConfig, RuleSetting } from "../../src/types";
import {
  type CLIOptions,
  loadAllowlistFile,
  mergeConfig,
  parseRuleFlag,
} from "../flags";

describe("parseRuleFlag", () => {
  it("parses a redact action", () => {
    const result = parseRuleFlag("email:redact");
    expect(result.id).toBe("email");
    expect(result.setting).toEqual({ action: "redact" });
  });

  it("parses a mask action", () => {
    const result = parseRuleFlag("phone:mask");
    expect(result.id).toBe("phone");
    expect(result.setting).toEqual({ action: "mask" });
  });

  it("parses a remove action", () => {
    const result = parseRuleFlag("ssn:remove");
    expect(result.id).toBe("ssn");
    expect(result.setting).toEqual({ action: "remove" });
  });

  it("parses a format-preserve action", () => {
    const result = parseRuleFlag("iban:format-preserve");
    expect(result.id).toBe("iban");
    expect(result.setting).toEqual({ action: "format-preserve" });
  });

  it("parses a token-replace action", () => {
    const result = parseRuleFlag("email:token-replace");
    expect(result.id).toBe("email");
    expect(result.setting).toEqual({ action: "token-replace" });
  });

  it("parses off as a string sentinel", () => {
    const result = parseRuleFlag("person_name_lite:off");
    expect(result.id).toBe("person_name_lite");
    expect(result.setting).toBe("off");
  });

  it("throws on missing colon", () => {
    expect(() => parseRuleFlag("email")).toThrow("expected format");
  });

  it("throws on missing id", () => {
    expect(() => parseRuleFlag(":redact")).toThrow("missing rule ID");
  });

  it("throws on unknown action", () => {
    expect(() => parseRuleFlag("email:unknown")).toThrow("unknown action");
  });
});

describe("mergeConfig", () => {
  const emptyOptions: CLIOptions = {
    positional: [],
  };

  it("returns empty rules when no base config and no flags", () => {
    const config = mergeConfig(undefined, emptyOptions, new Map(), []);
    expect(config.rules).toEqual({});
  });

  it("presets from base and flags are unioned", () => {
    const base: RedactorConfig = {
      rules: {},
      presets: ["pii"],
    };
    const options: CLIOptions = {
      ...emptyOptions,
      preset: "security",
    };
    const config = mergeConfig(base, options, new Map(), []);
    expect(config.presets).toEqual(["pii", "security"]);
  });

  it("flag rules override base rules", () => {
    const base: RedactorConfig = {
      rules: { email: { action: "redact" } },
    };
    const rules = new Map<string, RuleSetting | "off">([
      ["email", { action: "mask" }],
    ]);
    const config = mergeConfig(base, emptyOptions, rules, []);
    expect(config.rules).toEqual({ email: { action: "mask" } });
  });

  it("off setting disables a rule", () => {
    const base: RedactorConfig = {
      rules: { email: { action: "redact" } },
    };
    const rules = new Map<string, RuleSetting | "off">([["email", "off"]]);
    const config = mergeConfig(base, emptyOptions, rules, []);
    expect(config.rules).toEqual({ email: "off" });
  });

  it("allowlist from base and flags are concatenated", () => {
    const base: RedactorConfig = {
      rules: {},
      allowlist: ["a@example.com"],
    };
    const config = mergeConfig(base, emptyOptions, new Map(), [
      "b@example.com",
    ]);
    expect(config.allowlist).toEqual(["a@example.com", "b@example.com"]);
  });

  it("restore flag sets config.restore to true", () => {
    const options: CLIOptions = {
      ...emptyOptions,
      restore: true,
    };
    const config = mergeConfig(undefined, options, new Map(), []);
    expect(config.restore).toBe(true);
  });

  it("noRestore overrides base restore: true", () => {
    const base: RedactorConfig = {
      rules: {},
      restore: true,
    };
    const options: CLIOptions = {
      ...emptyOptions,
      noRestore: true,
    };
    const config = mergeConfig(base, options, new Map(), []);
    expect(config.restore).toBe(false);
  });

  it("semantic flag sets config.semantic with provided apiKey", () => {
    const options: CLIOptions = {
      ...emptyOptions,
      semantic: true,
    };
    const config = mergeConfig(undefined, options, new Map(), [], "test-key");
    expect(config.semantic?.provider).toBe("jev");
    expect(config.semantic?.apiKey).toBe("test-key");
  });

  it("semantic flag sets config.semantic with empty apiKey when not provided", () => {
    const options: CLIOptions = {
      ...emptyOptions,
      semantic: true,
    };
    const config = mergeConfig(undefined, options, new Map(), []);
    expect(config.semantic?.provider).toBe("jev");
    expect(config.semantic?.apiKey).toBe("");
  });

  it("maxInputLength flag sets config.limits", () => {
    const options: CLIOptions = {
      ...emptyOptions,
      maxInputLength: 5000,
    };
    const config = mergeConfig(undefined, options, new Map(), []);
    expect(config.limits).toEqual({ maxInputLength: 5000 });
  });

  it("allowlist defaults to empty array when neither base nor flags provide one", () => {
    const config = mergeConfig(undefined, emptyOptions, new Map(), []);
    expect(config.allowlist).toEqual([]);
  });
});

describe("loadAllowlistFile", () => {
  it("reads lines from a file", async () => {
    const path = "/tmp/sensored-allowlist-test.txt";
    writeFileSync(path, "a@example.com\nb@example.com\n\n  c@example.com  \n");
    const result = await loadAllowlistFile(path);
    expect(result).toEqual(["a@example.com", "b@example.com", "c@example.com"]);
  });
});
