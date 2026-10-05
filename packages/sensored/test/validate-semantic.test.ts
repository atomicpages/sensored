import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

describe("semantic config validation", () => {
  test("valid semantic config is accepted", () => {
    const redactor = createRedactor({
      rules: { person_name_lite: { action: "redact" } },
      semantic: {
        provider: "jev",
        apiKey: "test-key",
      },
    });

    expect(redactor).toBeDefined();
  });

  test("valid semantic config with all optional fields is accepted", () => {
    const redactor = createRedactor({
      rules: { person_name_lite: { action: "redact" } },
      semantic: {
        provider: "jev",
        apiKey: "test-key",
        model: "jev-1",
        contextWindow: 500,
        thresholds: { confidence: 0.8 },
      },
    });

    expect(redactor).toBeDefined();
  });

  test("invalid provider throws INVALID_CONFIG", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: { provider: "invalid" as "jev", apiKey: "test" },
      }),
    ).toThrow(SensoredError);
  });

  test("missing apiKey throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: { provider: "jev" } as never,
      }),
    ).toThrow(SensoredError);
  });

  test("empty apiKey throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: { provider: "jev", apiKey: "" },
      }),
    ).toThrow(SensoredError);
  });

  test("contextWindow of 0 throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: { provider: "jev", apiKey: "test", contextWindow: 0 },
      }),
    ).toThrow(SensoredError);
  });

  test("negative contextWindow throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: { provider: "jev", apiKey: "test", contextWindow: -1 },
      }),
    ).toThrow(SensoredError);
  });

  test("non-integer contextWindow throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: { provider: "jev", apiKey: "test", contextWindow: 1.5 },
      }),
    ).toThrow(SensoredError);
  });

  test("negative threshold throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: {
          provider: "jev",
          apiKey: "test",
          thresholds: { confidence: -0.1 },
        },
      }),
    ).toThrow(SensoredError);
  });

  test("threshold greater than 1 throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: {
          provider: "jev",
          apiKey: "test",
          thresholds: { confidence: 1.1 },
        },
      }),
    ).toThrow(SensoredError);
  });

  test("non-number threshold throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: {
          provider: "jev",
          apiKey: "test",
          thresholds: { confidence: "high" as unknown as number },
        },
      }),
    ).toThrow(SensoredError);
  });

  test("unknown keys in semantic config throw", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: {
          provider: "jev",
          apiKey: "test",
          extraField: true,
        } as never,
      }),
    ).toThrow(SensoredError);
  });

  test("no semantic config is fine", () => {
    const redactor = createRedactor({
      rules: { person_name_lite: { action: "redact" } },
    });

    expect(redactor).toBeDefined();
  });

  test("invalid model type throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: {
          provider: "jev",
          apiKey: "test",
          model: 123,
        } as never,
      }),
    ).toThrow(SensoredError);
  });

  test("thresholds boundary values 0 and 1 are accepted", () => {
    const redactor = createRedactor({
      rules: { person_name_lite: { action: "redact" } },
      semantic: {
        provider: "jev",
        apiKey: "test",
        thresholds: { min: 0, max: 1 },
      },
    });

    expect(redactor).toBeDefined();
  });

  test("non-object thresholds throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: {
          provider: "jev",
          apiKey: "test",
          thresholds: "high",
        } as never,
      }),
    ).toThrow(SensoredError);
  });

  test("NaN threshold throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: {
          provider: "jev",
          apiKey: "test",
          thresholds: { confidence: NaN },
        },
      }),
    ).toThrow(SensoredError);
  });

  test("Infinity threshold throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "redact" } },
        semantic: {
          provider: "jev",
          apiKey: "test",
          thresholds: { confidence: Infinity },
        },
      }),
    ).toThrow(SensoredError);
  });
});

describe("semanticConfirm detector validation", () => {
  test("semanticConfirm as non-function throws", () => {
    expect(() =>
      createRedactor({
        rules: { custom: { action: "redact" } },
        detectors: [
          {
            id: "custom",
            entityType: "custom",
            replacement: "[CUSTOM]",
            pattern: /\bTEST\b/g,
            semanticConfirm: "not a function" as never,
          },
        ],
      }),
    ).toThrow(SensoredError);
  });

  test("semanticConfirm as a function is accepted", () => {
    const redactor = createRedactor({
      rules: { custom: { action: "redact" } },
      detectors: [
        {
          id: "custom",
          entityType: "custom",
          replacement: "[CUSTOM]",
          pattern: /\bTEST\b/g,
          semanticConfirm: () => undefined,
        },
      ],
    });

    expect(redactor).toBeDefined();
  });
});
