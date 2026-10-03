import { describe, expect, test } from "bun:test";
import { createRedactor, MAX_INPUT_LENGTH, SensoredError } from "../src";

const basicRedactor = createRedactor({
  rules: {
    email: { action: "redact" },
    phone: { action: "redact" },
  },
});

const semanticRedactor = createRedactor({
  rules: { person_name_lite: { action: "redact" } },
  semantic: {
    provider: "jev",
    apiKey: "fake-key-for-testing",
  },
});

describe("redactAsync — basic behavior without semantic config", () => {
  test("returns Promise<AsyncRedactResult>", async () => {
    const result = basicRedactor.redactAsync("contact john@example.com");
    expect(result).toBeInstanceOf(Promise);
    const resolved = await result;
    expect(resolved).toHaveProperty("text");
    expect(resolved).toHaveProperty("detections");
  });

  test("text output matches redact()", async () => {
    const input = "email john@example.com or call 415-555-1234";
    const syncResult = basicRedactor.redact(input);
    const asyncResult = await basicRedactor.redactAsync(input);
    expect(asyncResult.text).toBe(syncResult);
  });

  test("detections have semanticConfirmed: true", async () => {
    const result = await basicRedactor.redactAsync(
      "email john@example.com or call 415-555-1234",
    );
    expect(result.detections).toHaveLength(2);
    for (const detection of result.detections) {
      expect(detection.semanticConfirmed).toBe(true);
    }
  });

  test("detections do not have noul when no semantic config", async () => {
    const result = await basicRedactor.redactAsync("email john@example.com");
    for (const detection of result.detections) {
      expect(detection.noul).toBeUndefined();
    }
  });

  test("no warnings when no semantic config", async () => {
    const result = await basicRedactor.redactAsync("email john@example.com");
    expect(result.warnings).toBeUndefined();
  });
});

describe("redactAsync — semantic config without opted-in detectors", () => {
  const redactor = createRedactor({
    rules: { email: { action: "redact" } },
    semantic: {
      provider: "jev",
      apiKey: "fake-key-for-testing",
    },
  });

  test("all detections have semanticConfirmed: true", async () => {
    const result = await redactor.redactAsync("contact john@example.com");
    expect(result.detections).toHaveLength(1);
    expect(result.detections[0]?.semanticConfirmed).toBe(true);
  });

  test("no warnings when no candidates are generated", async () => {
    const result = await redactor.redactAsync("contact john@example.com");
    expect(result.warnings).toBeUndefined();
  });
});

describe("redactAsync — semantic config with person_name_lite", () => {
  test("fails open when Jev unavailable", async () => {
    const result = await semanticRedactor.redactAsync(
      "Contact John Smith today",
    );
    expect(result.text).toBe("[PERSON_NAME] today");
    expect(result.detections).toHaveLength(1);
    expect(result.detections[0]?.semanticConfirmed).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings?.length).toBeGreaterThan(0);
  }, 30000);

  test("warnings contain semantic failure message", async () => {
    const result = await semanticRedactor.redactAsync("Hello John Smith");
    expect(result.warnings).toBeDefined();
    expect(result.warnings?.[0]).toContain("Semantic confirmation failed");
  }, 30000);
});

describe("redactAsync — restore mode", () => {
  const restoreRedactor = createRedactor({
    rules: { email: { action: "redact" } },
    restore: true,
  });

  test("result includes map when restore is true", async () => {
    const result = await restoreRedactor.redactAsync("email john@example.com");
    expect(result.map).toBeDefined();
    expect(result.map?.["[EMAIL_1]"]).toBe("john@example.com");
  });

  test("result does not include map when restore is false", async () => {
    const result = await basicRedactor.redactAsync("email john@example.com");
    expect(result.map).toBeUndefined();
  });
});

describe("redactAsync — input validation", () => {
  test("throws on non-string input", async () => {
    expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await basicRedactor.redactAsync(123 as any);
    }).toThrow(SensoredError);
  });

  test("throws on oversized input", async () => {
    const oversized = "a".repeat(MAX_INPUT_LENGTH + 1);
    expect(async () => {
      await basicRedactor.redactAsync(oversized);
    }).toThrow(SensoredError);
  });

  test("throws SensoredError with INPUT_LIMIT code on oversized input", async () => {
    const oversized = "a".repeat(MAX_INPUT_LENGTH + 1);
    try {
      await basicRedactor.redactAsync(oversized);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SensoredError);
      expect((err as SensoredError).code).toBe("INPUT_LIMIT");
    }
  });
});

describe("redactAsync — text matches redact() for complex input", () => {
  test("matches for multiple entity types", async () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "redact" },
        payment_card: { action: "redact" },
        phone: { action: "redact" },
      },
    });
    const input =
      "email john@example.com card 4111111111111111 call 415-555-1234";
    const syncResult = redactor.redact(input);
    const asyncResult = await redactor.redactAsync(input);
    expect(asyncResult.text).toBe(syncResult);
  });
});

describe("stream — semantic config warning", () => {
  test("stream warns when semantic config is present", async () => {
    const originalWarn = console.warn;
    let warned = false;
    console.warn = () => {
      warned = true;
    };

    async function* chunks() {
      yield "test text";
    }

    for await (const _ of semanticRedactor.stream(chunks())) {
      // consume
    }

    console.warn = originalWarn;
    expect(warned).toBe(true);
  });

  test("stream does not warn when semantic config is absent", async () => {
    const originalWarn = console.warn;
    let warned = false;
    console.warn = () => {
      warned = true;
    };

    async function* chunks() {
      yield "test text";
    }

    for await (const _ of basicRedactor.stream(chunks())) {
      // consume
    }

    console.warn = originalWarn;
    expect(warned).toBe(false);
  });
});
