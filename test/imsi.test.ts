import { describe, expect, test } from "bun:test";
import { imsiDetector } from "../src/detectors/identity/imsi";
import type { Detection } from "../src/types";

function detect(text: string): Detection[] {
  return imsiDetector.detect(text);
}

function redact(text: string): string {
  const detections = detect(text);
  let result = "";
  let last = 0;

  for (const d of detections) {
    result += text.slice(last, d.start);
    result += imsiDetector.replacement;
    last = d.end;
  }

  result += text.slice(last);

  return result;
}

describe("imsi detector — positive cases", () => {
  test.each([
    ["IMSI: 310260123456789", "IMSI: [IMSI]"],
    ["Subscriber ID: 445670123456789", "Subscriber ID: [IMSI]"],
    ["Mobile Subscriber: 234150987654321", "Mobile Subscriber: [IMSI]"],
    ["310260123456789 (IMSI)", "[IMSI] (IMSI)"],
    ["Subscriber Number: 123456789012345", "Subscriber Number: [IMSI]"],
    ["Subscriber-ID: 310260123456789", "Subscriber-ID: [IMSI]"],
    ["SubscriberID: 310260123456789", "SubscriberID: [IMSI]"],
    ["Mobile-Subscriber: 234150987654321", "Mobile-Subscriber: [IMSI]"],
    ["imsi: 310260123456789", "imsi: [IMSI]"],
    ["IMSI# 310260123456789", "IMSI# [IMSI]"],
  ])("%s", (input, expected) => {
    expect(redact(input)).toBe(expected);
  });
});

describe("imsi detector — negative cases", () => {
  test.each([
    ["310260123456789", "no context"],
    ["My number is 310260123456789", "wrong context"],
    ["Phone: 310260123456789", "non-approved label"],
    [
      "111111111111111",
      "all same digit with context — no match because all-same-digit",
    ],
    ["IMSI: 111111111111111", "all same digit with context"],
    ["IMSI: 310260000000005", "Luhn-valid 15-digit number should not match"],
    ["IMSI: 12345678901234", "14 digits too short"],
    ["IMSI: 1234567890123456", "16 digits too long"],
    ["x310260123456789", "embedded in word with context"],
    ["myIMSI: 310260123456789", "label not whole — my prefix"],
    ["IMSIx: 310260123456789", "label not whole — x suffix"],
  ])("%s (%s)", (input) => {
    expect(redact(input)).toBe(input);
  });
});

describe("imsi detector — boundary cases", () => {
  test("IMSI at start of string with following context", () => {
    expect(redact("310260123456789 (IMSI)")).toBe("[IMSI] (IMSI)");
  });

  test("IMSI at end of string with preceding context", () => {
    expect(redact("IMSI: 310260123456789")).toBe("IMSI: [IMSI]");
  });

  test("multiple IMSIs in one text", () => {
    expect(redact("IMSI: 310260123456789 and IMSI: 445670123456789")).toBe(
      "IMSI: [IMSI] and IMSI: [IMSI]",
    );
  });

  test("punctuation after IMSI is preserved", () => {
    expect(redact("IMSI: 310260123456789.")).toBe("IMSI: [IMSI].");
  });

  test("IMSI in parentheses with preceding context", () => {
    expect(redact("(IMSI: 310260123456789)")).toBe("(IMSI: [IMSI])");
  });

  test("tabs and spaces between label and candidate", () => {
    expect(redact("IMSI:\t310260123456789")).toBe("IMSI:\t[IMSI]");
  });

  test("spaces before following context", () => {
    expect(redact("310260123456789\t(IMSI)")).toBe("[IMSI]\t(IMSI)");
  });
});

describe("imsi detector — inspection", () => {
  test("detect returns correct spans, ruleId, entityType, reasons", () => {
    const result = detect("IMSI: 310260123456789");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      start: 6,
      end: 21,
      ruleId: "imsi",
      entityType: "imsi",
      reasons: ["imsi.format", "imsi.context"],
    });
  });

  test("detect for following context", () => {
    const result = detect("310260123456789 (IMSI)");
    expect(result).toHaveLength(1);
    expect(result[0]?.start).toBe(0);
    expect(result[0]?.end).toBe(15);
  });

  test("detect for multiple matches", () => {
    const result = detect("IMSI: 310260123456789 and IMSI: 445670123456789");
    expect(result).toHaveLength(2);
    expect(result[0]?.start).toBe(6);
    expect(result[0]?.end).toBe(21);
    expect(result[1]?.start).toBe(32);
    expect(result[1]?.end).toBe(47);
  });
});

describe("imsi detector — adversarial", () => {
  test("emoji before candidate does not prevent match", () => {
    expect(redact("\ud83d\ude00 IMSI: 310260123456789")).toBe(
      "\ud83d\ude00 IMSI: [IMSI]",
    );
  });

  test("does not redact already-redacted text", () => {
    expect(redact("IMSI: [IMSI]")).toBe("IMSI: [IMSI]");
  });

  test("handles empty string", () => {
    expect(detect("")).toHaveLength(0);
  });

  test("handles string with no digits", () => {
    expect(detect("!@#$%^&*()")).toHaveLength(0);
  });

  test("Luhn-valid 15-digit number is rejected even with context", () => {
    expect(detect("IMSI: 310260000000005")).toHaveLength(0);
  });

  test("all-same-digit number is rejected even with context", () => {
    expect(detect("IMSI: 111111111111111")).toHaveLength(0);
  });
});
