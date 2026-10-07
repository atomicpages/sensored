import { describe, expect, it } from "bun:test";
import type { RedactorConfig } from "sensored";
import { createLangfuseMaskFunction } from "../src/langfuse/mask-adapter";

const config: RedactorConfig = {
  rules: {
    email: { action: "redact" },
    phone: { action: "redact" },
  },
};

describe("createLangfuseMaskFunction", () => {
  it("returns a function", () => {
    const mask = createLangfuseMaskFunction(config);

    expect(typeof mask).toBe("function");
  });

  it("returns a string from the mask function", () => {
    const mask = createLangfuseMaskFunction(config);
    const result = mask({ data: "Contact alice@example.com" });

    expect(typeof result).toBe("string");
  });

  it("redacts email addresses", () => {
    const mask = createLangfuseMaskFunction(config);
    const input = "Contact alice@example.com for details";
    const result = mask({ data: input });

    expect(result).not.toContain("alice@example.com");
    expect(result).toContain("[EMAIL]");
  });

  it("redacts phone numbers", () => {
    const mask = createLangfuseMaskFunction(config);
    const input = "Call +1 (555) 123-4567 now";
    const result = mask({ data: input });

    expect(result).not.toContain("+1 (555) 123-4567");
    expect(result).toContain("[PHONE]");
  });

  it("redacts multiple PII types in the same input", () => {
    const mask = createLangfuseMaskFunction(config);
    const input = "Email alice@example.com or call +1 (555) 123-4567";
    const result = mask({ data: input });

    expect(result).not.toContain("alice@example.com");
    expect(result).not.toContain("+1 (555) 123-4567");
    expect(result).toContain("[EMAIL]");
    expect(result).toContain("[PHONE]");
  });

  it("produces consistent output for the same input", () => {
    const mask = createLangfuseMaskFunction(config);
    const input = "Contact alice@example.com or call +1 (555) 123-4567";

    const first = mask({ data: input });
    const second = mask({ data: input });

    expect(first).toBe(second);
  });

  it("leaves non-PII text unchanged", () => {
    const mask = createLangfuseMaskFunction(config);
    const input = "This is a plain message with no PII";
    const result = mask({ data: input });

    expect(result).toBe(input);
  });
});
