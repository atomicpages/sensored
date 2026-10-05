import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const CLI = join(__dirname, "..", "..", "dist", "cli", "index.mjs");

function runCli(
  args: string[],
  input?: string,
): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  const proc = Bun.spawnSync({
    cmd: ["bun", CLI, ...args],
    stdin: input ? Buffer.from(input) : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
    exitCode: proc.exitCode ?? 0,
  };
}

const TMP = "/tmp/sensored-cli-test";

beforeEach(() => {
  if (existsSync(TMP)) {
    rmSync(TMP, { recursive: true });
  }
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  if (existsSync(TMP)) {
    rmSync(TMP, { recursive: true });
  }
});

describe("CLI integration", () => {
  describe("--version", () => {
    it("prints version and exits 0", () => {
      const result = runCli(["--version"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("redact (pipe mode)", () => {
    it("redacts email from stdin", () => {
      const result = runCli(
        ["--rule", "email:redact", "--no-config"],
        "Contact john@example.com today",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("[EMAIL]");
      expect(result.stdout).not.toContain("john@example.com");
    });

    it("redacts with preset", () => {
      const result = runCli(
        ["--preset", "pii", "--no-config"],
        "Email: john@example.com, SSN: 123-45-6789",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("[EMAIL]");
      expect(result.stdout).toContain("[REDACTED]");
    });

    it("outputs JSON with --json", () => {
      const result = runCli(
        ["--rule", "email:redact", "--no-config", "--json"],
        "Contact john@example.com",
      );
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.text).toContain("[EMAIL]");
      expect(parsed.detections).toBeDefined();
    });

    it("writes restoration map in --json --restore --restore-map pipe mode", () => {
      const mapPath = join(TMP, "map.json");

      const result = runCli(
        [
          "--rule",
          "email:redact",
          "--no-config",
          "--json",
          "--restore",
          "--restore-map",
          mapPath,
        ],
        "Contact john@example.com",
      );

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.text).toContain("[EMAIL_1]");
      expect(parsed.map).toBeDefined();
      expect(existsSync(mapPath)).toBe(true);
      const map = JSON.parse(readFileSync(mapPath, "utf-8"));
      expect(map["[EMAIL_1]"]).toBe("john@example.com");
    });
  });

  describe("redact (file mode)", () => {
    it("reads input file and writes to output file", () => {
      const input = join(TMP, "input.txt");
      const output = join(TMP, "output.txt");
      writeFileSync(input, "Contact john@example.com");

      const result = runCli([
        input,
        output,
        "--rule",
        "email:redact",
        "--no-config",
      ]);

      expect(result.exitCode).toBe(0);
      const content = readFileSync(output, "utf-8");
      expect(content).toContain("[EMAIL]");
      expect(content).not.toContain("john@example.com");
    });

    it("refuses to overwrite existing output without --force", () => {
      const input = join(TMP, "input.txt");
      const output = join(TMP, "output.txt");
      writeFileSync(input, "Contact john@example.com");
      writeFileSync(output, "existing content");

      const result = runCli([
        input,
        output,
        "--rule",
        "email:redact",
        "--no-config",
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("already exists");
    });

    it("overwrites with --force", () => {
      const input = join(TMP, "input.txt");
      const output = join(TMP, "output.txt");
      writeFileSync(input, "Contact john@example.com");
      writeFileSync(output, "existing content");

      const result = runCli([
        input,
        output,
        "--rule",
        "email:redact",
        "--no-config",
        "--force",
      ]);

      expect(result.exitCode).toBe(0);
      const content = readFileSync(output, "utf-8");
      expect(content).toContain("[EMAIL]");
    });

    it("writes restoration map sidecar with --restore", () => {
      const input = join(TMP, "input.txt");
      const output = join(TMP, "output.txt");
      writeFileSync(input, "Contact john@example.com");

      const result = runCli([
        input,
        output,
        "--rule",
        "email:redact",
        "--no-config",
        "--restore",
      ]);

      expect(result.exitCode).toBe(0);
      const mapPath = join(TMP, "output.map.json");
      expect(existsSync(mapPath)).toBe(true);
      const map = JSON.parse(readFileSync(mapPath, "utf-8"));
      expect(map["[EMAIL_1]"]).toBe("john@example.com");
    });

    it("does not treat flag values as subcommands", () => {
      const input = join(TMP, "input.txt");
      const output = join(TMP, "output.txt");
      writeFileSync(input, "Contact john@example.com");

      const result = runCli([
        "--allowlist",
        "redact",
        input,
        output,
        "--rule",
        "email:redact",
        "--no-config",
      ]);

      expect(result.exitCode).toBe(0);
      const content = readFileSync(output, "utf-8");
      expect(content).toContain("[EMAIL]");
    });
  });

  describe("inspect", () => {
    it("shows detections in table format", () => {
      const result = runCli(
        ["inspect", "--rule", "email:redact", "--no-config"],
        "Contact john@example.com",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("email");
      expect(result.stdout).toContain("john@example.com");
    });

    it("outputs JSON with --json", () => {
      const result = runCli(
        ["inspect", "--rule", "email:redact", "--no-config", "--json"],
        "Contact john@example.com",
      );
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed[0].ruleId).toBe("email");
    });

    it("writes Total count to stderr not stdout", () => {
      const result = runCli(
        ["inspect", "--rule", "email:redact", "--no-config"],
        "Contact john@example.com",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Total:");
      expect(result.stdout).not.toContain("Total:");
    });
  });

  describe("restore", () => {
    it("restores redacted text using a map file", () => {
      const redacted = join(TMP, "redacted.txt");
      const mapFile = join(TMP, "map.json");
      const output = join(TMP, "restored.txt");
      writeFileSync(redacted, "Contact [EMAIL_1]");
      writeFileSync(
        mapFile,
        JSON.stringify({ "[EMAIL_1]": "john@example.com" }),
      );

      const result = runCli(["restore", redacted, mapFile, output]);

      expect(result.exitCode).toBe(0);
      const content = readFileSync(output, "utf-8");
      expect(content).toBe("Contact john@example.com");
    });

    it("restores from stdin with --map", () => {
      const mapFile = join(TMP, "map.json");
      writeFileSync(
        mapFile,
        JSON.stringify({ "[EMAIL_1]": "john@example.com" }),
      );

      const result = runCli(["restore", "--map", mapFile], "Contact [EMAIL_1]");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("Contact john@example.com");
    });

    it("restores from file with --map flag and output file", () => {
      const redacted = join(TMP, "redacted.txt");
      const mapFile = join(TMP, "map.json");
      const output = join(TMP, "restored.txt");
      writeFileSync(redacted, "Contact [EMAIL_1]");
      writeFileSync(
        mapFile,
        JSON.stringify({ "[EMAIL_1]": "john@example.com" }),
      );

      const result = runCli(["restore", redacted, "--map", mapFile, output]);

      expect(result.exitCode).toBe(0);
      const content = readFileSync(output, "utf-8");
      expect(content).toBe("Contact john@example.com");
    });

    it("errors without --map", () => {
      const result = runCli(["restore"], "Contact [EMAIL_1]");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("--map is required");
      expect(result.stderr).toContain("sensored:");
    });
  });

  describe("list-detectors", () => {
    it("lists detectors in table format", () => {
      const result = runCli(["list-detectors"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("ID");
      expect(result.stdout).toContain("email");
    });

    it("outputs JSON with --json", () => {
      const result = runCli(["list-detectors", "--json"]);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(100);
    });
  });

  describe("list-presets", () => {
    it("lists presets in table format", () => {
      const result = runCli(["list-presets"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Preset");
      expect(result.stdout).toContain("pii");
    });

    it("outputs JSON with --json", () => {
      const result = runCli(["list-presets", "--json"]);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.some((p: { name: string }) => p.name === "pii")).toBe(true);
    });
  });

  describe("no rules enabled", () => {
    it("exits with code 1 when no rules and no config", () => {
      const result = runCli(["--no-config"], "test text");
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("At least one rule must be enabled");
    });
  });

  describe("invalid rule flag", () => {
    it("errors on bad rule format", () => {
      const result = runCli(["--rule", "invalid", "--no-config"], "test text");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("expected format");
    });
  });

  describe("allowlist", () => {
    it("excludes allowlisted values from redaction", () => {
      const result = runCli(
        [
          "--rule",
          "email:redact",
          "--allowlist",
          "john@example.com",
          "--no-config",
        ],
        "Contact john@example.com or jane@example.com",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("john@example.com");
      expect(result.stdout).toContain("[EMAIL]");
    });
  });

  describe("allowlist-file", () => {
    it("reads allowlist from a file", () => {
      const allowlistFile = join(TMP, "allow.txt");
      writeFileSync(allowlistFile, "john@example.com\n");

      const result = runCli(
        [
          "--rule",
          "email:redact",
          "--allowlist-file",
          allowlistFile,
          "--no-config",
        ],
        "Contact john@example.com or jane@example.com",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("john@example.com");
      expect(result.stdout).toContain("[EMAIL]");
    });
  });
});
