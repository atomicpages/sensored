import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";
import { legalReferenceDetector } from "../src/detectors/legal/legal-reference";

const redactor = createRedactor({
  rules: { legal_reference: { action: "redact" } },
});

describe("Legal reference complete-string processing", () => {
  test.each([
    ["Matter No: ABC123456", "Matter No: [LEGAL_REFERENCE]"],
    ["Engagement No: ABC123456789", "Engagement No: [LEGAL_REFERENCE]"],
    ["Client Matter No: ABC123456", "Client Matter No: [LEGAL_REFERENCE]"],
    ["Settlement ID: ABC123456", "Settlement ID: [LEGAL_REFERENCE]"],
    ["Agreement No: ABC123456789", "Agreement No: [LEGAL_REFERENCE]"],
    ["Client ID: ABC123456", "Client ID: [LEGAL_REFERENCE]"],
    ["Client No: ABC123456789", "Client No: [LEGAL_REFERENCE]"],
    ["Retainer No: ABC123456", "Retainer No: [LEGAL_REFERENCE]"],
    [
      "Retainer Agreement: ABC123456789",
      "Retainer Agreement: [LEGAL_REFERENCE]",
    ],
    ["NDA No: ABC123456", "NDA No: [LEGAL_REFERENCE]"],
    ["NDA Agreement No: ABC123456789", "NDA Agreement No: [LEGAL_REFERENCE]"],
    ["Confidentiality No: ABC123456", "Confidentiality No: [LEGAL_REFERENCE]"],
    ["Non-Disclosure No: ABC123456789", "Non-Disclosure No: [LEGAL_REFERENCE]"],
    ["Contract No: ABC123456", "Contract No: [LEGAL_REFERENCE]"],
    ["CNTR No: 12345678", "CNTR No: [LEGAL_REFERENCE]"],
    ["CNTR-NO: 12345678", "CNTR-NO: [LEGAL_REFERENCE]"],
    ["MATTER# ABC123456", "MATTER# [LEGAL_REFERENCE]"],
    ["Legal Matter: ABC123456", "Legal Matter: [LEGAL_REFERENCE]"],
    ["Law Firm Matter: ABC123456789", "Law Firm Matter: [LEGAL_REFERENCE]"],
    ["Attorney Client: ABC123456", "Attorney Client: [LEGAL_REFERENCE]"],
    ["Counsel Matter: ABC123456", "Counsel Matter: [LEGAL_REFERENCE]"],
    ["matter no: abc123456", "matter no: [LEGAL_REFERENCE]"],
    ["ABC123456 (Matter)", "[LEGAL_REFERENCE] (Matter)"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: ABC123456", "non-approved label"],
    ["ABC123456", "no label"],
    ["myMatter: ABC123456", "label not whole — my prefix"],
    ["Matterx: ABC123456", "label not whole — x suffix"],
    ["Matter:\nABC123456", "newline between label and candidate"],
    ["Matter:         ABC123456", "9 spaces exceeds 0-8"],
    ["Matter No: ABCDEFGHI", "no digit in candidate"],
    ["ABC123456 (Reference)", "non-approved following label"],
    ["ABC123456(Matter)", "0 spaces before paren — following requires 1-8"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("minimum length candidate (6 chars) is redacted", () => {
    expect(redactor.redact("Matter No: A12345")).toBe(
      "Matter No: [LEGAL_REFERENCE]",
    );
  });

  test("below minimum length candidate (5 chars) is not redacted", () => {
    expect(redactor.redact("Matter No: A1234")).toBe("Matter No: A1234");
  });

  test("maximum length candidate (15 chars) is redacted", () => {
    expect(redactor.redact("Matter No: ABC123456789012")).toBe(
      "Matter No: [LEGAL_REFERENCE]",
    );
  });

  test("above maximum length candidate (16 chars) is not redacted", () => {
    expect(redactor.redact("Matter No: ABC1234567890123")).toBe(
      "Matter No: ABC1234567890123",
    );
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Matter No: ABC123456");
    expect(result.text).toBe("Matter No: [LEGAL_REFERENCE]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      ruleId: "legal_reference",
      entityType: "legal_reference",
      reasons: ["legal_reference.format", "legal_reference.context"],
    });
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        legal_reference: { action: "mask", preserve: { last: 4 } },
      },
    });
    const result = masker.redact("Matter No: ABC123456");
    expect(result).toContain("3456");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { legal_reference: { action: "remove" } },
    });
    expect(remover.redact("Matter No: ABC123456")).toBe("Matter No: ");
  });

  test("detector class detect() produces correct detections", () => {
    const detections = legalReferenceDetector.detect("Matter No: ABC123456");
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "legal_reference",
      entityType: "legal_reference",
      reasons: ["legal_reference.format", "legal_reference.context"],
    });
  });

  test("detector class rejects non-contextual matches", () => {
    const detections = legalReferenceDetector.detect("ABC123456");
    expect(detections).toHaveLength(0);
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { legal_reference: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.legal_reference)).toBe(true);
  });

  test("legal_reference off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { legal_reference: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown legal_reference rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { legal_reference: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
