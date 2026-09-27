import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("CLI scores synthetic input, blocks release, and protects existing files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sensored-eval-"));
  try {
    const corpus = join(directory, "corpus.json");
    await Bun.write(
      corpus,
      JSON.stringify({
        revision: "cli-synthetic",
        provenance: "synthetic",
        reviewed: false,
        rules: ["email"],
        cases: [
          {
            id: "a",
            text: "a@example.com",
            kind: "supported",
            expected: [{ ruleId: "email", start: 0, end: 13 }],
          },
        ],
      }),
    );
    const output = join(directory, "report.json");
    const run = (command: string, destination: string) =>
      Bun.spawnSync([
        process.execPath,
        "eval/cli.ts",
        command,
        corpus,
        destination,
      ]);
    expect(run("score", output).exitCode).toBe(0);
    const report = await Bun.file(output).json();
    expect(report.micro.tp).toBe(1);
    expect(report.gate.passed).toBe(false);
    expect(await Bun.file(output).text()).not.toContain("a@example.com");
    expect(run("gate", join(directory, "gate.json")).exitCode).toBe(1);
    expect(run("score", corpus).exitCode).toBe(2);
    expect(await Bun.file(corpus).text()).toContain("a@example.com");
    await Bun.write(corpus, "malformed a@example.com");
    const invalid = run("score", join(directory, "invalid.json"));
    expect(invalid.exitCode).toBe(2);
    expect(invalid.stderr.toString()).not.toContain("a@example.com");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
