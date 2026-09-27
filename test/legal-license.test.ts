import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";
import { legalLicenseDetector } from "../src/detectors/legal/legal-license";

const redactor = createRedactor({
  rules: { legal_license: { action: "redact" } },
});

describe("Legal license complete-string processing", () => {
  test.each([
    ["Bar No: ABC12345", "Bar No: [LEGAL_LICENSE]"],
    ["Attorney No: ABC123456", "Attorney No: [LEGAL_LICENSE]"],
    ["Lawyer No: ABC123456789", "Lawyer No: [LEGAL_LICENSE]"],
    ["Bar License: ABC12345", "Bar License: [LEGAL_LICENSE]"],
    ["Bar Registration: ABC123456", "Bar Registration: [LEGAL_LICENSE]"],
    ["Notary License: ABC123456", "Notary License: [LEGAL_LICENSE]"],
    ["Notary Commission: ABC123456789", "Notary Commission: [LEGAL_LICENSE]"],
    ["Notarial No: ABC123456", "Notarial No: [LEGAL_LICENSE]"],
    ["Court Reporter No: AB123456", "Court Reporter No: [LEGAL_LICENSE]"],
    [
      "Court Reporter License: AB12345678",
      "Court Reporter License: [LEGAL_LICENSE]",
    ],
    ["CSR No: AB123456", "CSR No: [LEGAL_LICENSE]"],
    ["RPR No: ABC12345678", "RPR No: [LEGAL_LICENSE]"],
    ["BAR# ABC12345", "BAR# [LEGAL_LICENSE]"],
    ["License: ABC123456", "License: [LEGAL_LICENSE]"],
    ["Commission: ABC123456789", "Commission: [LEGAL_LICENSE]"],
    ["Legal Bar: ABC12345", "Legal Bar: [LEGAL_LICENSE]"],
    ["Law Firm Bar: ABC123456", "Law Firm Bar: [LEGAL_LICENSE]"],
    ["bar no: abc12345", "bar no: [LEGAL_LICENSE]"],
    ["ABC12345 (Bar)", "[LEGAL_LICENSE] (Bar)"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: ABC12345", "non-approved label"],
    ["ABC12345", "no label"],
    ["myBar: ABC12345", "label not whole — my prefix"],
    ["Barx: ABC12345", "label not whole — x suffix"],
    ["Bar:\nABC12345", "newline between label and candidate"],
    ["Bar:         ABC12345", "9 spaces exceeds 0-8"],
    ["Bar No: ABCDEFGHI", "no digit in candidate"],
    ["ABC12345 (Reference)", "non-approved following label"],
    ["ABC12345(Bar)", "0 spaces before paren — following requires 1-8"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("minimum length candidate (5 chars) is redacted", () => {
    expect(redactor.redact("Bar No: A1234")).toBe("Bar No: [LEGAL_LICENSE]");
  });

  test("below minimum length candidate (4 chars) is not redacted", () => {
    expect(redactor.redact("Bar No: A123")).toBe("Bar No: A123");
  });

  test("maximum length candidate (12 chars) is redacted", () => {
    expect(redactor.redact("Bar No: ABC123456789")).toBe(
      "Bar No: [LEGAL_LICENSE]",
    );
  });

  test("above maximum length candidate (13 chars) is not redacted", () => {
    expect(redactor.redact("Bar No: ABC1234567890")).toBe(
      "Bar No: ABC1234567890",
    );
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Bar No: ABC12345");
    expect(result.text).toBe("Bar No: [LEGAL_LICENSE]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      ruleId: "legal_license",
      entityType: "legal_license",
      reasons: ["legal_license.format", "legal_license.context"],
    });
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        legal_license: { action: "mask", preserve: { last: 4 } },
      },
    });
    const result = masker.redact("Bar No: ABC12345");
    expect(result).toContain("2345");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { legal_license: { action: "remove" } },
    });
    expect(remover.redact("Bar No: ABC12345")).toBe("Bar No: ");
  });

  test("detector class detect() produces correct detections", () => {
    const detections = legalLicenseDetector.detect("Bar No: ABC12345");
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "legal_license",
      entityType: "legal_license",
      reasons: ["legal_license.format", "legal_license.context"],
    });
  });

  test("detector class rejects non-contextual matches", () => {
    const detections = legalLicenseDetector.detect("ABC12345");
    expect(detections).toHaveLength(0);
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { legal_license: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.legal_license)).toBe(true);
  });

  test("legal_license off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { legal_license: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown legal_license rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { legal_license: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
