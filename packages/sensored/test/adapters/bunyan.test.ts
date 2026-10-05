import { describe, expect, test } from "bun:test";
import { bunyanRedact } from "../../src/loggers/bunyan";

describe("bunyanRedact", () => {
  const stream = {
    lines: [] as string[],
    write(str: string): void {
      this.lines.push(str);
    },
  };

  const redactStream = bunyanRedact(
    { rules: { email: { action: "redact" } } },
    stream,
  );

  test("redacts email in msg field", () => {
    stream.lines = [];
    redactStream.write({ msg: "Contact alice@example.com", level: 30 });
    const rec = JSON.parse(stream.lines[0]!);
    expect(rec.msg).toBe("Contact [EMAIL]");
    expect(rec.level).toBe(30);
  });

  test("redacts sensitive field names to [REDACTED]", () => {
    stream.lines = [];
    redactStream.write({ authorization: "Bearer abc123", msg: "ok" });
    const rec = JSON.parse(stream.lines[0]!);
    expect(rec.authorization).toBe("[REDACTED]");
    expect(rec.msg).toBe("ok");
  });

  test("redacts PII in nested objects", () => {
    stream.lines = [];
    redactStream.write({ user: { email: "alice@example.com" } });
    const rec = JSON.parse(stream.lines[0]!);
    expect(rec.user.email).toBe("[EMAIL]");
  });

  test("redacts PII in array values", () => {
    stream.lines = [];
    redactStream.write({ emails: ["alice@example.com", "bob@test.org"] });
    const rec = JSON.parse(stream.lines[0]!);
    expect(rec.emails).toEqual(["[EMAIL]", "[EMAIL]"]);
  });

  test("does not mutate the original log record object", () => {
    stream.lines = [];
    const original = { msg: "alice@example.com", level: 30 };
    redactStream.write(original);
    expect(original.msg).toBe("alice@example.com");
    expect(original.level).toBe(30);
  });

  test("detectOnly mode leaves log records unmodified", () => {
    stream.lines = [];
    const ro = bunyanRedact(
      {
        rules: { email: { action: "redact" } },
        detectOnly: true,
      },
      stream,
    );
    ro.write({ msg: "alice@example.com" });
    const rec = JSON.parse(stream.lines[0]!);
    expect(rec.msg).toBe("alice@example.com");
  });

  test("redacts multiple PII types in one record", () => {
    stream.lines = [];
    const multi = bunyanRedact(
      {
        rules: {
          email: { action: "redact" },
          phone: { action: "redact" },
        },
      },
      stream,
    );
    multi.write({ msg: "Contact alice@example.com or +1-555-123-4567" });
    const rec = JSON.parse(stream.lines[0]!);
    expect(rec.msg).toBe("Contact [EMAIL] or [PHONE]");
  });

  test("handles multiple sequential writes through the same stream", () => {
    stream.lines = [];
    redactStream.write({ msg: "alice@example.com" });
    redactStream.write({ msg: "bob@test.org" });
    const rec0 = JSON.parse(stream.lines[0]!);
    const rec1 = JSON.parse(stream.lines[1]!);
    expect(rec0.msg).toBe("[EMAIL]");
    expect(rec1.msg).toBe("[EMAIL]");
  });

  test("write returns true (bunyan raw stream contract)", () => {
    const result = redactStream.write({ msg: "alice@example.com" });
    expect(result).toBe(true);
  });
});
