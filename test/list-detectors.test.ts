import { describe, expect, test } from "bun:test";
import type { DetectorDefinition } from "../src";
import { createRedactor, listDetectors } from "../src";

describe("listDetectors()", () => {
  const detectors = listDetectors();

  test("returns a frozen array", () => {
    expect(Object.isFrozen(detectors)).toBe(true);
  });

  test("returns at least 100 detectors", () => {
    expect(detectors.length).toBeGreaterThanOrEqual(100);
  });

  test("every detector has required fields", () => {
    for (const d of detectors) {
      expect(typeof d.id).toBe("string");
      expect(typeof d.entityType).toBe("string");
      expect(typeof d.replacement).toBe("string");
      expect(typeof d.stream).toBe("boolean");
    }
  });

  test("detector ids are unique", () => {
    const ids = new Set(detectors.map((d) => d.id));
    expect(ids.size).toBe(detectors.length);
  });

  test("includes us_ssn with contextHint", () => {
    const ssn = detectors.find((d) => d.id === "us_ssn");
    expect(ssn).toBeDefined();
    expect(ssn!.contextHint).toBeDefined();
    expect(ssn!.contextHint!.required).toBe(true);
    expect(ssn!.contextHint!.labels).toContain("SSN");
    expect(ssn!.contextHint!.labels).toContain("Social Security Number");
    expect(ssn!.contextHint!.labels).toContain("Social Security No.");
    expect(ssn!.contextHint!.position).toBe("both");
    expect(ssn!.contextHint!.window.before).toBe(39);
    expect(ssn!.contextHint!.window.after).toBe(32);
  });

  test("context-optional detectors have no contextHint", () => {
    const email = detectors.find((d) => d.id === "email");
    expect(email).toBeDefined();
    expect(email!.contextHint).toBeUndefined();
  });

  test("generic_api_key has contextHint with instructions", () => {
    const apiKey = detectors.find((d) => d.id === "generic_api_key");
    expect(apiKey).toBeDefined();
    expect(apiKey!.contextHint).toBeDefined();
    expect(apiKey!.contextHint!.required).toBe(true);
    expect(apiKey!.contextHint!.labels).toContain("API key");
    expect(apiKey!.contextHint!.position).toBe("preceding");
    expect(apiKey!.contextHint!.instructions).toBeDefined();
    expect(typeof apiKey!.contextHint!.instructions).toBe("string");
  });

  test("digital_identity has contextHint with instructions", () => {
    const di = detectors.find((d) => d.id === "digital_identity");
    expect(di).toBeDefined();
    expect(di!.contextHint).toBeDefined();
    expect(di!.contextHint!.labels).toContain("Username");
    expect(di!.contextHint!.labels).toContain("Steam ID");
    expect(di!.contextHint!.instructions).toBeDefined();
  });

  test("hr_compensation has contextHint", () => {
    const hr = detectors.find((d) => d.id === "hr_compensation");
    expect(hr).toBeDefined();
    expect(hr!.contextHint).toBeDefined();
    expect(hr!.contextHint!.labels).toContain("Salary");
    expect(hr!.contextHint!.labels).toContain("401K Account No");
  });

  test("all contextHint objects are frozen", () => {
    for (const d of detectors) {
      if (d.contextHint !== undefined) {
        expect(Object.isFrozen(d.contextHint)).toBe(true);
        expect(Object.isFrozen(d.contextHint.labels)).toBe(true);
        expect(Object.isFrozen(d.contextHint.window)).toBe(true);
      }
    }
  });
});

describe("redactor.describe()", () => {
  const redactor = createRedactor({
    rules: { us_ssn: { action: "redact" }, email: { action: "redact" } },
  });

  const descriptions = redactor.describe();

  test("returns only active rules", () => {
    expect(descriptions.length).toBe(2);
    const ids = descriptions.map((d) => d.id).sort();
    expect(ids).toEqual(["email", "us_ssn"]);
  });

  test("returns a frozen array", () => {
    expect(Object.isFrozen(descriptions)).toBe(true);
  });

  test("includes contextHint for us_ssn", () => {
    const ssn = descriptions.find((d) => d.id === "us_ssn");
    expect(ssn!.contextHint).toBeDefined();
    expect(ssn!.contextHint!.labels).toContain("SSN");
  });

  test("email has no contextHint", () => {
    const email = descriptions.find((d) => d.id === "email");
    expect(email!.contextHint).toBeUndefined();
  });
});

describe("redactor.describe() with custom detector contextHint", () => {
  const customDetector: DetectorDefinition = {
    id: "custom_ctx",
    entityType: "custom_ctx",
    replacement: "[CUSTOM_CTX]",
    pattern: /\bCUST\d+\b/u,
    context: { before: 10, after: 5 },
    contextHint: {
      labels: ["Customer ID", "Account No"],
      position: "preceding",
      instructions: "Label must appear before the value.",
    },
  };

  const redactor = createRedactor({
    rules: { custom_ctx: { action: "redact" } },
    detectors: [customDetector],
  });

  test("exposes contextHint from DetectorDefinition", () => {
    const desc = redactor.describe();
    expect(desc.length).toBe(1);

    const hint = desc[0]!.contextHint;
    expect(hint).toBeDefined();
    expect(hint!.required).toBe(true);
    expect(hint!.labels).toContain("Customer ID");
    expect(hint!.labels).toContain("Account No");
    expect(hint!.position).toBe("preceding");
    expect(hint!.window.before).toBe(10);
    expect(hint!.window.after).toBe(5);
    expect(hint!.instructions).toBe("Label must appear before the value.");
  });
});

describe("redactor.describe() with custom detector without contextHint", () => {
  const customDetector: DetectorDefinition = {
    id: "no_ctx",
    entityType: "no_ctx",
    replacement: "[NO_CTX]",
    pattern: /\bFOO\d+\b/u,
  };

  const redactor = createRedactor({
    rules: { no_ctx: { action: "redact" } },
    detectors: [customDetector],
  });

  test("contextHint is undefined when not provided", () => {
    const desc = redactor.describe();
    expect(desc.length).toBe(1);
    expect(desc[0]!.contextHint).toBeUndefined();
  });
});
