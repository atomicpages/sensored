import { describe, expect, test } from "bun:test";
import { createRedactor, employeeIdExample, SensoredError } from "../src";

describe("detectOnly mode", () => {
  const redactor = createRedactor({
    rules: { email: { action: "redact" } },
    detectOnly: true,
  });

  test("redact returns original text unmodified", () => {
    const text = "Contact alice@example.com for details";
    expect(redactor.redact(text)).toBe(text);
  });

  test("inspect returns original text with detection groups", () => {
    const text = "Contact alice@example.com for details";
    const result = redactor.inspect(text);
    expect(result.text).toBe(text);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.replacement).toBe("alice@example.com");
  });

  test("stream emits original text with detection events", async () => {
    const r = createRedactor({
      rules: { email: { action: "redact" } },
      detectOnly: true,
    });

    const chunks = (async function* () {
      yield "Contact alice@";
      yield "example.com for details";
    })();

    const events: { type: string; text?: string; group?: unknown }[] = [];
    for await (const event of r.stream(chunks, { report: true })) {
      events.push(event);
    }

    const textEvents = events
      .filter((e) => e.type === "text")
      .map((e) => e.text)
      .join("");
    expect(textEvents).toBe("Contact alice@example.com for details");

    const detectionEvents = events.filter((e) => e.type === "detection");
    expect(detectionEvents).toHaveLength(1);
  });

  test("no restoration map generated (redact returns string)", () => {
    const result = redactor.redact("Contact alice@example.com");
    expect(typeof result).toBe("string");
  });

  test("detections are still accurate (same matches as without detectOnly)", () => {
    const withDetect = createRedactor({
      rules: { email: { action: "redact" } },
      detectOnly: true,
    });
    const withoutDetect = createRedactor({
      rules: { email: { action: "redact" } },
    });

    const text = "Email alice@example.com and bob@test.org";
    const detectResult = withDetect.inspect(text);
    const normalResult = withoutDetect.inspect(text);

    expect(detectResult.groups).toHaveLength(normalResult.groups.length);
    expect(detectResult.groups[0]!.start).toBe(normalResult.groups[0]!.start);
    expect(detectResult.groups[0]!.end).toBe(normalResult.groups[0]!.end);
  });

  test("works with presets", () => {
    const r = createRedactor({
      presets: ["pii"],
      rules: {},
      detectOnly: true,
    });

    const text = "Contact alice@example.com for details";
    expect(r.redact(text)).toBe(text);
  });

  test("redactAsync returns original text + detections when detectOnly: true", async () => {
    const r = createRedactor({
      rules: { email: { action: "redact" } },
      detectOnly: true,
    });

    const text = "Contact alice@example.com for details";
    const result = await r.redactAsync(text);
    expect(result.text).toBe(text);
    expect(result.detections).toHaveLength(1);
    expect(result.detections[0]!.ruleId).toBe("email");
  });

  test("detectOnly: true + restore: true throws INVALID_CONFIG", () => {
    expect(() =>
      createRedactor({
        rules: { email: { action: "redact" } },
        detectOnly: true,
        restore: true,
      }),
    ).toThrow(SensoredError);
  });

  test("detectOnly: false (explicit) works identically to omitting", () => {
    const r = createRedactor({
      rules: { email: { action: "redact" } },
      detectOnly: false,
    });

    const text = "Contact alice@example.com for details";
    const result = r.redact(text);
    expect(result).not.toBe(text);
    expect(result).toContain("[EMAIL]");
  });

  test("detectOnly: undefined works identically to false", () => {
    const r = createRedactor({
      rules: { email: { action: "redact" } },
      detectOnly: undefined,
    });

    const text = "Contact alice@example.com for details";
    const result = r.redact(text);
    expect(result).not.toBe(text);
    expect(result).toContain("[EMAIL]");
  });

  test("detection group replacement field contains original text slice", () => {
    const text = "Contact alice@example.com for details";
    const result = redactor.inspect(text);
    expect(result.groups[0]!.replacement).toBe("alice@example.com");
  });

  test("streaming with detectOnly: text events contain original text, detection events still emitted", async () => {
    const r = createRedactor({
      rules: { email: { action: "redact" } },
      detectOnly: true,
    });

    const chunks = (async function* () {
      yield "Contact alice@";
      yield "example.com for details";
    })();

    const events: { type: string; text?: string; group?: unknown }[] = [];
    for await (const event of r.stream(chunks, { report: true })) {
      events.push(event);
    }

    const textEvents = events
      .filter((e) => e.type === "text")
      .map((e) => e.text)
      .join("");
    expect(textEvents).toBe("Contact alice@example.com for details");

    const detectionEvents = events.filter((e) => e.type === "detection");
    expect(detectionEvents).toHaveLength(1);

    const group = (detectionEvents[0] as { group: { replacement: string } })
      .group;
    expect(group!.replacement).toBe("alice@example.com");
  });

  test("works with allowlist (allowlisted values not detected)", () => {
    const r = createRedactor({
      rules: { email: { action: "redact" } },
      detectOnly: true,
      allowlist: ["alice@example.com"],
    });

    const text = "Contact alice@example.com for details";
    const result = r.inspect(text);
    expect(result.text).toBe(text);
    expect(result.groups).toHaveLength(0);
  });

  test("works with custom detectors", () => {
    const r = createRedactor({
      rules: { employee_id_example: { action: "redact" } },
      detectors: [employeeIdExample],
      detectOnly: true,
    });

    const text = "Employee ID: AB123456 for details";
    expect(r.redact(text)).toBe(text);

    const result = r.inspect(text);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.replacement).toBe("AB123456");
  });
});
