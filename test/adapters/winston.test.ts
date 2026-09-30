import { describe, expect, test } from "bun:test";
import { winstonRedact } from "../../src/loggers/winston";

describe("winstonRedact", () => {
  const transform = winstonRedact({
    rules: { email: { action: "redact" } },
  });

  test("redacts email in message field", () => {
    const result = transform({
      level: "info",
      message: "Contact alice@example.com",
    });
    expect(result.message).toBe("Contact [EMAIL]");
    expect(result.level).toBe("info");
  });

  test("redacts sensitive field names", () => {
    const result = transform({
      authorization: "Bearer abc123",
    });
    expect(result.authorization).toBe("[REDACTED]");
  });

  test("preserves symbol-keyed properties (Winston metadata)", () => {
    const sym = Symbol.for("sens");
    const result = transform({
      [sym]: "alice@example.com",
      message: "test",
    });
    expect((result as Record<PropertyKey, unknown>)[sym]).toBe("[EMAIL]");
    expect(result.message).toBe("test");
  });

  test("does not mutate original info object", () => {
    const original = { message: "alice@example.com" };
    transform(original);
    expect(original.message).toBe("alice@example.com");
  });

  test("detectOnly mode leaves text unmodified", () => {
    const t = winstonRedact({
      rules: { email: { action: "redact" } },
      detectOnly: true,
    });
    const result = t({ message: "alice@example.com" });
    expect(result.message).toBe("alice@example.com");
  });

  test("redacts nested objects", () => {
    const result = transform({
      user: { email: "alice@example.com" },
    });
    expect((result.user as { email: string }).email).toBe("[EMAIL]");
  });

  test("handles arrays", () => {
    const result = transform({
      emails: ["alice@example.com", "bob@test.org"],
    });
    expect(result.emails).toEqual(["[EMAIL]", "[EMAIL]"]);
  });

  test("handles multiple PII types in one record", () => {
    const t = winstonRedact({
      rules: {
        email: { action: "redact" },
        phone: { action: "redact" },
      },
    });
    const result = t({
      message: "Contact alice@example.com or +1-555-123-4567",
      user: { email: "bob@example.com", phone: "+1-555-987-6543" },
    });
    expect(result.message).toBe("Contact [EMAIL] or [PHONE]");
    expect((result.user as { email: string; phone: string }).email).toBe(
      "[EMAIL]",
    );
    expect((result.user as { email: string; phone: string }).phone).toBe(
      "[PHONE]",
    );
  });

  test("transform is chainable (returns the object so it can be piped)", () => {
    const info = { level: "info", message: "alice@example.com" };
    const result = transform(info);
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    expect(result.level).toBe("info");
    expect(result.message).toBe("[EMAIL]");
  });
});
