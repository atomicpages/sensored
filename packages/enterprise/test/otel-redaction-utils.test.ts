import { describe, expect, it } from "bun:test";
import { createRedactor, type RedactorConfig } from "sensored";
import {
  type RedactionConfig,
  redactAttributes,
  shouldRedactAttribute,
} from "../src/otel/redaction-utils";

const testConfig: RedactorConfig = {
  rules: {
    email: { action: "redact" },
    phone: { action: "redact" },
  },
};

const redactionConfig: RedactionConfig = {
  redactorConfig: testConfig,
};

describe("shouldRedactAttribute", () => {
  it("returns true for all keys when no include/exclude lists", () => {
    expect(shouldRedactAttribute("foo", redactionConfig)).toBe(true);
    expect(shouldRedactAttribute("bar", redactionConfig)).toBe(true);
  });

  it("returns true only for keys in includeAttributes", () => {
    const config: RedactionConfig = {
      redactorConfig: testConfig,
      includeAttributes: ["user", "email"],
    };

    expect(shouldRedactAttribute("user", config)).toBe(true);
    expect(shouldRedactAttribute("email", config)).toBe(true);
    expect(shouldRedactAttribute("phone", config)).toBe(false);
  });

  it("returns false for keys in excludeAttributes", () => {
    const config: RedactionConfig = {
      redactorConfig: testConfig,
      excludeAttributes: ["safe", "public"],
    };

    expect(shouldRedactAttribute("safe", config)).toBe(false);
    expect(shouldRedactAttribute("public", config)).toBe(false);
    expect(shouldRedactAttribute("user", config)).toBe(true);
  });

  it("includeAttributes takes precedence over excludeAttributes", () => {
    const config: RedactionConfig = {
      redactorConfig: testConfig,
      includeAttributes: ["user"],
      excludeAttributes: ["user"],
    };

    expect(shouldRedactAttribute("user", config)).toBe(true);
    expect(shouldRedactAttribute("other", config)).toBe(false);
  });
});

describe("redactAttributes", () => {
  it("redacts all string attributes by default", () => {
    const redactor = createRedactor(testConfig);
    const attrs = {
      name: "John Doe",
      email: "john@example.com",
      age: 30,
      active: true,
    };

    const result = redactAttributes(attrs, redactionConfig, redactor);

    expect(result.email).not.toContain("john@example.com");
    expect(result.name).toBe("John Doe");
    expect(result.age).toBe(30);
    expect(result.active).toBe(true);
  });

  it("respects includeAttributes", () => {
    const redactor = createRedactor(testConfig);
    const config: RedactionConfig = {
      redactorConfig: testConfig,
      includeAttributes: ["email"],
    };

    const attrs = {
      email: "john@example.com",
      phone: "+1-555-123-4567",
      name: "John Doe",
    };

    const result = redactAttributes(attrs, config, redactor);

    expect(result.email).not.toContain("john@example.com");
    expect(result.phone).toBe("+1-555-123-4567");
    expect(result.name).toBe("John Doe");
  });

  it("respects excludeAttributes", () => {
    const redactor = createRedactor(testConfig);
    const config: RedactionConfig = {
      redactorConfig: testConfig,
      excludeAttributes: ["name"],
    };

    const attrs = {
      email: "john@example.com",
      name: "John Doe",
    };

    const result = redactAttributes(attrs, config, redactor);

    expect(result.email).not.toContain("john@example.com");
    expect(result.name).toBe("John Doe");
  });

  it("passes non-string values through unchanged", () => {
    const redactor = createRedactor(testConfig);
    const attrs = {
      count: 42,
      active: true,
      data: null,
      nested: { key: "value" },
    };

    const result = redactAttributes(attrs, redactionConfig, redactor);

    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.data).toBe(null);
    expect(result.nested).toEqual({ key: "value" });
  });

  it("does not mutate the original attributes object", () => {
    const redactor = createRedactor(testConfig);
    const attrs = { email: "john@example.com" };

    const result = redactAttributes(attrs, redactionConfig, redactor);

    expect(attrs.email).toBe("john@example.com");
    expect(result.email).not.toBe(attrs.email);
  });

  it("handles empty attributes", () => {
    const redactor = createRedactor(testConfig);
    const result = redactAttributes({}, redactionConfig, redactor);

    expect(result).toEqual({});
  });
});
