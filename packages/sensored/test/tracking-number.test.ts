import { describe, expect, test } from "bun:test";
import { trackingNumberDetector } from "../src/detectors/logistics/tracking-number";
import type { Detection } from "../src/types";

function detect(text: string): Detection[] {
  return trackingNumberDetector.detect(text);
}

function redact(text: string): string {
  const detections = detect(text);
  let result = "";
  let last = 0;

  for (const d of detections) {
    result += text.slice(last, d.start);
    result += trackingNumberDetector.replacement;
    last = d.end;
  }

  result += text.slice(last);

  return result;
}

describe("tracking number detector — positive cases", () => {
  test.each([
    [
      "Tracking Number: 1Z999AA10123456788",
      "Tracking Number: [TRACKING_NUMBER]",
    ],
    ["Tracking Number: 123456789010", "Tracking Number: [TRACKING_NUMBER]"],
    ["Tracking Number: 123456789012343", "Tracking Number: [TRACKING_NUMBER]"],
    [
      "Tracking Number: 9400111899223100123457",
      "Tracking Number: [TRACKING_NUMBER]",
    ],
    ["Tracking Number: 1234567891", "Tracking Number: [TRACKING_NUMBER]"],
    ["Tracking No.: 1Z999AA10123456788", "Tracking No.: [TRACKING_NUMBER]"],
    ["Tracking ID: 1234567891", "Tracking ID: [TRACKING_NUMBER]"],
    ["Package ID: 9400111899223100123457", "Package ID: [TRACKING_NUMBER]"],
    ["Shipment ID: 1Z999AA10123456788", "Shipment ID: [TRACKING_NUMBER]"],
    ["Waybill No.: 1234567891", "Waybill No.: [TRACKING_NUMBER]"],
    ["Consignment No.: 123456789012343", "Consignment No.: [TRACKING_NUMBER]"],
    [
      "Tracking Number: 1Z999AA10123456788.",
      "Tracking Number: [TRACKING_NUMBER].",
    ],
    ["Tracking Number:1Z999AA10123456788", "Tracking Number:[TRACKING_NUMBER]"],
    ["Tracking Number# 1234567891", "Tracking Number# [TRACKING_NUMBER]"],
    [
      "1Z999AA10123456788 (Tracking Number)",
      "[TRACKING_NUMBER] (Tracking Number)",
    ],
    ["1234567891 (Tracking ID)", "[TRACKING_NUMBER] (Tracking ID)"],
    ["123456789010 Tracking Number", "[TRACKING_NUMBER] Tracking Number"],
    [
      "Tracking Number: 1Z999AA10123456788 and Tracking Number: 1234567891",
      "Tracking Number: [TRACKING_NUMBER] and Tracking Number: [TRACKING_NUMBER]",
    ],
    [
      "Package ID: 9400111899223100123457 and Waybill No.: 123456789012343",
      "Package ID: [TRACKING_NUMBER] and Waybill No.: [TRACKING_NUMBER]",
    ],
    [
      "tracking number: 1Z999AA10123456788",
      "tracking number: [TRACKING_NUMBER]",
    ],
    ["TRACKING NUMBER: 1234567891", "TRACKING NUMBER: [TRACKING_NUMBER]"],
    ["Package-ID: 123456789010", "Package-ID: [TRACKING_NUMBER]"],
    ["Shipment-ID: 9400111899223100123457", "Shipment-ID: [TRACKING_NUMBER]"],
    ["Tracking Number:\t1234567891", "Tracking Number:\t[TRACKING_NUMBER]"],
    ["Tracking Number: \t 1234567891", "Tracking Number: \t [TRACKING_NUMBER]"],
  ])("%s", (input, expected) => {
    expect(redact(input)).toBe(expected);
  });
});

describe("tracking number detector — negative cases", () => {
  test.each([
    ["1Z999AA10123456788", "no context"],
    ["1234567891", "no context — DHL"],
    ["123456789010", "no context — FedEx Express"],
    ["123456789012343", "no context — FedEx Ground"],
    ["9400111899223100123457", "no context — USPS"],
    ["Reference: 1234567891", "wrong context label"],
    ["Order Number: 1Z999AA10123456788", "non-approved label"],
    ["Tracking Number: 1Z999AA10123456789", "invalid UPS checksum"],
    ["Tracking Number: 123456789011", "invalid FedEx Express checksum"],
    ["Tracking Number: 123456789012349", "invalid FedEx Ground checksum"],
    ["Tracking Number: 9400111899223100123459", "invalid USPS checksum"],
    ["Tracking Number: 1234567890", "invalid DHL checksum"],
    ["myTracking Number: 1234567891", "label not whole — my prefix"],
    ["Tracking Numberx: 1234567891", "label not whole — x suffix"],
    ["Tracking Number:\n1234567891", "newline between label and candidate"],
    ["Tracking Number:         1234567891", "9 spaces exceeds 0-8"],
    [
      "1234567891(Tracking Number)",
      "0 spaces before paren — following requires 1-8",
    ],
    ["1234567891 (Tracking Number", "missing closing paren"],
    ["Tracking Number: x1234567891", "letter before candidate — adjacency"],
    ["Tracking Number: 1234567891x", "letter after candidate"],
    ["Tracking Number: 1234567891_", "underscore after candidate"],
    ["_Tracking Number: 1234567891", "underscore before label"],
    ["Tracking  Number: 1234567891", "double space in multiword label"],
    ["Tracking\tNumber: 1234567891", "tab in multiword label"],
    ["xTracking Number: 1234567891", "letter before label — adjacency"],
  ])("%s (%s)", (input) => {
    expect(redact(input)).toBe(input);
  });
});

describe("tracking number detector — boundary cases", () => {
  test("tracking number at start of string with following context", () => {
    expect(redact("1Z999AA10123456788 (Tracking Number)")).toBe(
      "[TRACKING_NUMBER] (Tracking Number)",
    );
  });

  test("tracking number at end of string with preceding context", () => {
    expect(redact("Tracking Number: 1Z999AA10123456788")).toBe(
      "Tracking Number: [TRACKING_NUMBER]",
    );
  });

  test("multiple tracking numbers in one text", () => {
    expect(
      redact(
        "Tracking Number: 1Z999AA10123456788 and Tracking Number: 1234567891",
      ),
    ).toBe(
      "Tracking Number: [TRACKING_NUMBER] and Tracking Number: [TRACKING_NUMBER]",
    );
  });

  test("trailing period is preserved", () => {
    expect(redact("Tracking Number: 1234567891.")).toBe(
      "Tracking Number: [TRACKING_NUMBER].",
    );
  });

  test("trailing text is preserved", () => {
    expect(redact("Tracking Number: 1234567891 extra")).toBe(
      "Tracking Number: [TRACKING_NUMBER] extra",
    );
  });

  test("parenthesized tracking number with context", () => {
    expect(redact("(Tracking Number: 1234567891)")).toBe(
      "(Tracking Number: [TRACKING_NUMBER])",
    );
  });

  test("all five carriers in one text", () => {
    const input =
      "Tracking Number: 1Z999AA10123456788, Tracking Number: 123456789010, " +
      "Tracking Number: 123456789012343, Tracking Number: 9400111899223100123457, " +
      "Tracking Number: 1234567891";
    const expected =
      "Tracking Number: [TRACKING_NUMBER], Tracking Number: [TRACKING_NUMBER], " +
      "Tracking Number: [TRACKING_NUMBER], Tracking Number: [TRACKING_NUMBER], " +
      "Tracking Number: [TRACKING_NUMBER]";
    expect(redact(input)).toBe(expected);
  });
});

describe("tracking number detector — inspection", () => {
  test("detect returns correct spans, ruleId, entityType, reasons for UPS", () => {
    const result = detect("Tracking Number: 1Z999AA10123456788");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      start: 17,
      end: 35,
      ruleId: "tracking_number",
      entityType: "tracking_number",
      reasons: [
        "tracking_number.ups_checksum",
        "tracking_number.format",
        "tracking_number.context",
      ],
    });
  });

  test("detect returns correct spans for DHL", () => {
    const result = detect("Tracking Number: 1234567891");
    expect(result).toHaveLength(1);
    expect(result[0]?.start).toBe(17);
    expect(result[0]?.end).toBe(27);
  });

  test("detect returns correct spans for FedEx Express", () => {
    const result = detect("Tracking Number: 123456789010");
    expect(result).toHaveLength(1);
    expect(result[0]?.start).toBe(17);
    expect(result[0]?.end).toBe(29);
  });

  test("detect returns correct spans for FedEx Ground", () => {
    const result = detect("Tracking Number: 123456789012343");
    expect(result).toHaveLength(1);
    expect(result[0]?.start).toBe(17);
    expect(result[0]?.end).toBe(32);
  });

  test("detect returns correct spans for USPS", () => {
    const result = detect("Tracking Number: 9400111899223100123457");
    expect(result).toHaveLength(1);
    expect(result[0]?.start).toBe(17);
    expect(result[0]?.end).toBe(39);
  });

  test("detect for following context", () => {
    const result = detect("1234567891 (Tracking Number)");
    expect(result).toHaveLength(1);
    expect(result[0]?.start).toBe(0);
    expect(result[0]?.end).toBe(10);
  });

  test("detect for multiple matches", () => {
    const result = detect(
      "Tracking Number: 1Z999AA10123456788 and Tracking Number: 1234567891",
    );
    expect(result).toHaveLength(2);
    expect(result[0]?.start).toBe(17);
    expect(result[0]?.end).toBe(35);
    expect(result[1]?.start).toBe(57);
    expect(result[1]?.end).toBe(67);
  });
});

describe("tracking number detector — adversarial", () => {
  test("emoji before candidate does not shift alignment", () => {
    expect(redact("\ud83d\ude00 Tracking Number: 1234567891")).toBe(
      "\ud83d\ude00 Tracking Number: [TRACKING_NUMBER]",
    );
  });

  test("does not match random text without context", () => {
    expect(redact("The quick brown fox 1234567891 jumps")).toBe(
      "The quick brown fox 1234567891 jumps",
    );
  });

  test("handles empty string", () => {
    expect(detect("")).toHaveLength(0);
  });

  test("handles string with no alphanumeric characters", () => {
    expect(detect("!@#$%^&*()")).toHaveLength(0);
  });

  test("context label must be whole word", () => {
    expect(redact("XTracking Number: 1234567891")).toBe(
      "XTracking Number: 1234567891",
    );
    expect(redact("Tracking NumberX: 1234567891")).toBe(
      "Tracking NumberX: 1234567891",
    );
  });

  test("does not redact already-redacted text", () => {
    expect(redact("Tracking Number: [TRACKING_NUMBER]")).toBe(
      "Tracking Number: [TRACKING_NUMBER]",
    );
  });

  test("does not match invalid checksum with context", () => {
    expect(redact("Tracking Number: 1Z999AA10123456789")).toBe(
      "Tracking Number: 1Z999AA10123456789",
    );
  });

  test("does not match 11-digit sequence with context", () => {
    expect(redact("Tracking Number: 12345678901")).toBe(
      "Tracking Number: 12345678901",
    );
  });

  test("does not match 13-digit sequence with context", () => {
    expect(redact("Tracking Number: 1234567890123")).toBe(
      "Tracking Number: 1234567890123",
    );
  });
});
