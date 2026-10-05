import { describe, expect, test } from "bun:test";
import type { DetectorDefinition } from "../src";
import { createRedactor, SensoredError } from "../src";

const throwingDetector: DetectorDefinition = {
  id: "throwing_detector",
  entityType: "throwing_detector",
  replacement: "[THROWING_DETECTOR]",
  pattern: /\bTEST\d+\b/u,
  context: { before: 0, after: 0 },
  validate() {
    throw new TypeError("boom from validator");
  },
};

const contractDetector: DetectorDefinition = {
  id: "contract_detector",
  entityType: "contract_detector",
  replacement: "[CONTRACT_DETECTOR]",
  pattern: /\bTEST\d+\b/u,
  context: { before: 0, after: 0 },
  validate() {
    throw new SensoredError("DETECTOR_CONTRACT");
  },
};

describe("RegexDetector catch-all fix", () => {
  test("non-SensoredError from validator propagates as-is", () => {
    const redactor = createRedactor({
      rules: { throwing_detector: { action: "redact" } },
      detectors: [throwingDetector],
    });

    expect(() => redactor.redact("TEST123")).toThrow(TypeError);
    expect(() => redactor.redact("TEST123")).toThrow("boom from validator");
  });

  test("SensoredError from validator propagates as-is", () => {
    const redactor = createRedactor({
      rules: { contract_detector: { action: "redact" } },
      detectors: [contractDetector],
    });

    expect(() => redactor.redact("TEST123")).toThrow(SensoredError);
    expect(() => {
      try {
        redactor.redact("TEST123");
      } catch (error) {
        expect(error).toBeInstanceOf(SensoredError);
        expect((error as SensoredError).code).toBe("DETECTOR_CONTRACT");
        throw error;
      }
    }).toThrow(SensoredError);
  });
});
