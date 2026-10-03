import { describe, expect, it } from "bun:test";
import { createRedactor, redactValue } from "../src";

const redactor = createRedactor({
  rules: { email: { action: "redact" } },
});

const restoreRedactor = createRedactor({
  rules: { email: { action: "redact" } },
  restore: true,
});

describe("redactValue", () => {
  it("redacts strings in nested objects at all levels", () => {
    const input = {
      level1: {
        level2: {
          level3: "alice@example.com",
        },
        sibling: "bob@example.com",
      },
      top: "charlie@example.com",
    };

    const result = redactValue(input, redactor);

    expect(result).toEqual({
      level1: {
        level2: {
          level3: "[EMAIL]",
        },
        sibling: "[EMAIL]",
      },
      top: "[EMAIL]",
    });
  });

  it("redacts arrays of strings", () => {
    const input = ["alice@example.com", "bob@example.com", "plain text"];
    const result = redactValue(input, redactor);
    expect(result).toEqual(["[EMAIL]", "[EMAIL]", "plain text"]);
  });

  it("redacts arrays of objects", () => {
    const input = [
      { email: "alice@example.com" },
      { email: "bob@example.com" },
    ];
    const result = redactValue(input, redactor);
    expect(result).toEqual([{ email: "[EMAIL]" }, { email: "[EMAIL]" }]);
  });

  it("redacts mixed arrays", () => {
    const input = [
      "alice@example.com",
      { nested: "bob@example.com" },
      ["carol@example.com"],
    ];
    const result = redactValue(input, redactor);
    expect(result).toEqual(["[EMAIL]", { nested: "[EMAIL]" }, ["[EMAIL]"]]);
  });

  it("redacts Map string keys and values", () => {
    const input = new Map([["alice@example.com", "bob@example.com"]]);
    const result = redactValue(input, redactor);
    expect(result.get("[EMAIL]")).toBe("[EMAIL]");
  });

  it("redacts Set string entries", () => {
    const input = new Set(["alice@example.com", "plain text"]);
    const result = redactValue(input, redactor);
    expect(result.has("[EMAIL]")).toBe(true);
    expect(result.has("plain text")).toBe(true);
  });

  it("redacts Error.message and preserves stack", () => {
    const input = new Error("Contact alice@example.com");
    const originalStack = input.stack;
    const result = redactValue(input, redactor) as Error;
    expect(result.message).toBe("Contact [EMAIL]");
    expect(result.stack).toBe(originalStack);
  });

  it("redacts URL.toString()", () => {
    const input = new URL("https://host.com/path");
    const result = redactValue(input, redactor) as URL;
    expect(result.toString()).toBe("https://host.com/path");
    expect(result).not.toBe(input);
    expect(result).toEqual(input);
  });

  it("redacts URLSearchParams values", () => {
    const input = new URLSearchParams("email=alice@example.com&name=alice");
    const result = redactValue(input, redactor) as URLSearchParams;
    expect(result.get("email")).toBe("[EMAIL]");
    expect(result.get("name")).toBe("alice");
  });

  it("handles circular references without infinite loop", () => {
    const input: Record<string, unknown> = { email: "alice@example.com" };
    input.self = input;
    const result = redactValue(input, redactor) as Record<string, unknown>;
    expect(result.email).toBe("[EMAIL]");
    expect(result.self).toBe(input);
  });

  it("passes through non-string primitives", () => {
    expect(redactValue(42, redactor)).toBe(42);
    expect(redactValue(true, redactor)).toBe(true);
    expect(redactValue(null, redactor)).toBe(null);
    expect(redactValue(undefined, redactor)).toBe(undefined);
    expect(redactValue(Symbol("test"), redactor).toString()).toContain("test");
    expect(redactValue(BigInt(123), redactor)).toBe(BigInt(123));
  });

  it("passes through Date objects without mutation", () => {
    const input = new Date("2024-01-01T00:00:00Z");
    const result = redactValue(input, redactor) as Date;
    expect(result.getTime()).toBe(input.getTime());
    expect(result).toBe(input);
  });

  it("passes through RegExp objects", () => {
    const input = /alice@example\.com/;
    const result = redactValue(input, redactor) as RegExp;
    expect(result.source).toBe(input.source);
    expect(result.flags).toBe(input.flags);
  });

  it("passes through function values", () => {
    const input = () => "alice@example.com";
    const result = redactValue(input, redactor);
    expect(result).toBe(input);
    expect(result()).toBe("alice@example.com");
  });

  it("does not mutate the input", () => {
    const input = {
      email: "alice@example.com",
      nested: { value: "bob@example.com" },
    };
    const copy = structuredClone(input);
    redactValue(input, redactor);
    expect(input).toEqual(copy);
  });

  it("detects sensitive field names case-insensitively", () => {
    const cases = [
      { field: "password", value: "alice@example.com" },
      { field: "Authorization", value: "alice@example.com" },
      { field: "API_KEY", value: "alice@example.com" },
      { field: "api_secret", value: "alice@example.com" },
      { field: "TOKEN", value: "alice@example.com" },
      { field: "Cookie", value: "alice@example.com" },
    ];

    for (const { field, value } of cases) {
      const input = { [field]: value };
      const result = redactValue(input, redactor) as Record<string, string>;
      expect(result[field]).toBe("[EMAIL]");
    }
  });

  it("traverses non-sensitive field values recursively", () => {
    const input = {
      user: {
        contact: "alice@example.com",
      },
    };
    const result = redactValue(input, redactor) as Record<
      string,
      Record<string, string>
    >;
    expect(result.user?.contact).toBe("[EMAIL]");
  });

  it("works with RedactorWithoutRestore (redact returns string)", () => {
    const input = { email: "alice@example.com" };
    const result = redactValue(input, redactor) as Record<string, string>;
    expect(result.email).toBe("[EMAIL]");
  });

  it("works with RedactorWithRestore (redact returns { text, map })", () => {
    const input = { email: "alice@example.com" };
    const result = redactValue(input, restoreRedactor) as Record<
      string,
      string
    >;
    expect(result.email).toBe("[EMAIL_1]");
  });

  it("redacts empty strings", () => {
    const input = { value: "" };
    const result = redactValue(input, redactor) as Record<string, string>;
    expect(result.value).toBe("");
  });

  it("passes through null and undefined inputs", () => {
    expect(redactValue(null, redactor)).toBe(null);
    expect(redactValue(undefined, redactor)).toBe(undefined);
  });

  it("preserves symbol-keyed properties", () => {
    const sym = Symbol("custom");
    const input = { [sym]: "alice@example.com", normal: "bob@example.com" };
    const result = redactValue(input, redactor) as Record<PropertyKey, unknown>;
    expect(result[sym]).toBe("[EMAIL]");
    expect(result.normal).toBe("[EMAIL]");
  });

  it("unconditionally redacts sensitive field values even when no detector matches", () => {
    const input = { password: "hello", name: "alice@example.com" };
    const result = redactValue(input, redactor) as Record<string, string>;
    expect(result.password).toBe("[REDACTED]");
    expect(result.name).toBe("[EMAIL]");
  });

  it("redacts sensitive field values case-insensitively", () => {
    const input = {
      Password: "secret123",
      AUTHORIZATION: "Bearer xyz",
      api_key: "abc123",
    };
    const result = redactValue(input, redactor) as Record<string, string>;
    expect(result.Password).toBe("[REDACTED]");
    expect(result.AUTHORIZATION).toBe("[REDACTED]");
    expect(result.api_key).toBe("[REDACTED]");
  });

  it("unconditionally redacts non-string values at sensitive keys", () => {
    const input = {
      password: 12345,
      secret: { hash: "abc" },
      token: true,
      api_key: ["key1", "key2"],
    };
    const result = redactValue(input, redactor) as Record<string, unknown>;
    expect(result.password).toBe("[REDACTED]");
    expect(result.secret).toBe("[REDACTED]");
    expect(result.token).toBe("[REDACTED]");
    expect(result.api_key).toBe("[REDACTED]");
  });

  it("passes through null and undefined at sensitive keys", () => {
    const input = { password: null, token: undefined };
    const result = redactValue(input, redactor) as Record<string, unknown>;
    expect(result.password).toBeNull();
    expect(result.token).toBeUndefined();
  });
});
