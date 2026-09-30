import { describe, expect, test } from "bun:test";
import { morganRedact } from "../../src/loggers/morgan";

describe("morganRedact", () => {
  const stream = {
    lines: [] as string[],
    write(str: string): void {
      this.lines.push(str);
    },
  };

  const redactStream = morganRedact(
    { rules: { email: { action: "redact" } } },
    stream,
  );

  test("redacts email in log line", () => {
    stream.lines = [];
    redactStream.write("GET /api alice@example.com 200");
    expect(stream.lines[0]).toBe("GET /api [EMAIL] 200");
  });

  test("passes through non-PII log lines unchanged", () => {
    stream.lines = [];
    redactStream.write("GET /health 200 1.234 ms");
    expect(stream.lines[0]).toBe("GET /health 200 1.234 ms");
  });

  test("does not mutate the original input string", () => {
    stream.lines = [];
    const original = "GET /contact alice@example.com 200";
    redactStream.write(original);
    expect(original).toBe("GET /contact alice@example.com 200");
  });

  test("detectOnly mode leaves log lines unmodified", () => {
    stream.lines = [];
    const ro = morganRedact(
      {
        rules: { email: { action: "redact" } },
        detectOnly: true,
      },
      stream,
    );
    ro.write("GET / alice@example.com 200");
    expect(stream.lines[0]).toBe("GET / alice@example.com 200");
  });

  test("redacts multiple PII types in one line", () => {
    stream.lines = [];
    const multi = morganRedact(
      {
        rules: {
          email: { action: "redact" },
          phone: { action: "redact" },
        },
      },
      stream,
    );
    multi.write("POST /api alice@example.com 201 - +15551234567");
    expect(stream.lines[0]).toBe("POST /api [EMAIL] 201 - [PHONE]");
  });

  test("handles multiple writes through the same stream", () => {
    stream.lines = [];
    redactStream.write("GET /a alice@example.com 200\n");
    redactStream.write("GET /b bob@test.org 200\n");
    expect(stream.lines).toEqual([
      "GET /a [EMAIL] 200\n",
      "GET /b [EMAIL] 200\n",
    ]);
  });

  test("write returns void (morgan stream contract)", () => {
    const result = redactStream.write("GET / alice@example.com 200");
    expect(result).toBeUndefined();
  });
});
