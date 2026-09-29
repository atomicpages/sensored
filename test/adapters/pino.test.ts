import { describe, expect, test } from "bun:test";
import { pinoRedact } from "../../src/adapters/pino";

describe("pinoRedact", () => {
  const formatter = pinoRedact({
    rules: { email: { action: "redact" } },
  });

  test("redacts email in message field", () => {
    const result = formatter.formatters.log({
      message: "Contact alice@example.com",
    });
    expect(result.message).toBe("Contact [EMAIL]");
  });

  test("redacts sensitive field names", () => {
    const result = formatter.formatters.log({
      authorization: "Bearer abc123",
    });
    expect(result.authorization).toBe("[REDACTED]");
  });

  test("does not mutate original log record", () => {
    const original = { message: "alice@example.com" };
    formatter.formatters.log(original);
    expect(original.message).toBe("alice@example.com");
  });

  test("detectOnly mode leaves text unmodified", () => {
    const f = pinoRedact({
      rules: { email: { action: "redact" } },
      detectOnly: true,
    });
    const result = f.formatters.log({ message: "alice@example.com" });
    expect(result.message).toBe("alice@example.com");
  });

  test("redacts nested objects", () => {
    const result = formatter.formatters.log({
      user: { email: "alice@example.com" },
    });
    expect((result.user as { email: string }).email).toBe("[EMAIL]");
  });

  test("handles array values", () => {
    const result = formatter.formatters.log({
      emails: ["alice@example.com", "bob@test.org"],
    });
    expect(result.emails).toEqual(["[EMAIL]", "[EMAIL]"]);
  });

  test("preserves symbol-keyed properties", () => {
    const sym = Symbol.for("message");
    const result = formatter.formatters.log({
      [sym]: "alice@example.com",
      level: "info",
    });
    expect((result as Record<PropertyKey, unknown>)[sym]).toBe("[EMAIL]");
    expect(result.level).toBe("info");
  });

  test("redacts multiple PII types in one record", () => {
    const f = pinoRedact({
      rules: {
        email: { action: "redact" },
        phone: { action: "redact" },
      },
    });
    const result = f.formatters.log({
      message: "Contact alice@example.com or +1-555-123-4567",
      contact: "bob@example.com",
    });
    expect(result.message).toBe("Contact [EMAIL] or [PHONE]");
    expect(result.contact).toBe("[EMAIL]");
  });
});
