import { describe, expect, test } from "bun:test";
import { licensePlateDetector } from "../src/detectors/identity/license-plate";
import type { Detection } from "../src/types";

function detect(text: string): Detection[] {
  return licensePlateDetector.detect(text);
}

function redact(text: string): string {
  const detections = detect(text);
  let result = "";
  let last = 0;

  for (const d of detections) {
    result += text.slice(last, d.start);
    result += licensePlateDetector.replacement;
    last = d.end;
  }

  result += text.slice(last);

  return result;
}

describe("license plate detector — positive cases", () => {
  test.each([
    // US generic plates
    ["License Plate: ABC123", "License Plate: [LICENSE_PLATE]"],
    ["License Plate: 1234567", "License Plate: [LICENSE_PLATE]"],
    ["License Plate Number: AB12CD", "License Plate Number: [LICENSE_PLATE]"],
    ["Tag Number: XYZ789", "Tag Number: [LICENSE_PLATE]"],
    ["License Plate No.: R8T9X", "License Plate No.: [LICENSE_PLATE]"],
    ["Plate No.: A1B2C3", "Plate No.: [LICENSE_PLATE]"],
    ["Plate Number: 7HFX294", "Plate Number: [LICENSE_PLATE]"],
    // UK plates
    ["License Plate: AB12CDE", "License Plate: [LICENSE_PLATE]"],
    ["License Plate: 12ABC", "License Plate: [LICENSE_PLATE]"],
    ["License Plate: ABC1234", "License Plate: [LICENSE_PLATE]"],
    // CA plates (6 chars without hyphen, 7 with)
    ["License Plate: A1B2C3", "License Plate: [LICENSE_PLATE]"],
    ["License Plate: A1B-2C3", "License Plate: [LICENSE_PLATE]"],
    // Registration context
    ["Registration: ABC123", "Registration: [LICENSE_PLATE]"],
    ["Vehicle Registration: AB12CD", "Vehicle Registration: [LICENSE_PLATE]"],
    // Case insensitive
    ["license plate: abc123", "license plate: [LICENSE_PLATE]"],
    ["LICENSE PLATE: ABC123", "LICENSE PLATE: [LICENSE_PLATE]"],
    ["registration: xyz789", "registration: [LICENSE_PLATE]"],
    // Following context
    ["ABC123 (License Plate)", "[LICENSE_PLATE] (License Plate)"],
    ["ABC123 License Plate", "[LICENSE_PLATE] License Plate"],
    ["A1B2C3 (Plate Number)", "[LICENSE_PLATE] (Plate Number)"],
    // Multiple plates
    [
      "License Plate: ABC123 and License Plate: DEF456",
      "License Plate: [LICENSE_PLATE] and License Plate: [LICENSE_PLATE]",
    ],
    // Punctuation after
    ["License Plate: ABC123.", "License Plate: [LICENSE_PLATE]."],
    ["(License Plate: ABC123)", "(License Plate: [LICENSE_PLATE])"],
    // With colon and hash variations
    ["License Plate# ABC123", "License Plate# [LICENSE_PLATE]"],
    ["License Plate:ABC123", "License Plate:[LICENSE_PLATE]"],
    ["License Plate#ABC123", "License Plate#[LICENSE_PLATE]"],
    // Tabs and spaces
    ["License Plate:\tABC123", "License Plate:\t[LICENSE_PLATE]"],
    ["License Plate: \t ABC123", "License Plate: \t [LICENSE_PLATE]"],
    ["ABC123\t(License Plate)", "[LICENSE_PLATE]\t(License Plate)"],
    ["ABC123    (License Plate)", "[LICENSE_PLATE]    (License Plate)"],
  ])("%s", (input, expected) => {
    expect(redact(input)).toBe(expected);
  });
});

describe("license plate detector — negative cases", () => {
  test.each([
    ["ABC123", "no context"],
    ["My number is ABC123", "wrong context"],
    ["Reference: ABC123", "non-approved label"],
    ["myLicense Plate: ABC123", "label not whole — my prefix"],
    ["License Platex: ABC123", "label not whole — x suffix"],
    ["License Plate:\nABC123", "newline between label and candidate"],
    ["License Plate:         ABC123", "9 spaces exceeds 0-8"],
    ["ABC123(License Plate)", "0 spaces before paren — following requires 1-8"],
    ["ABC123 (License Plate", "missing closing paren"],
    [
      "ABC12345x (License Plate)",
      "letter after candidate before following label",
    ],
    ["License Plate: ABC12345x", "letter after candidate"],
    ["License Plate: ABC12345x", "letter after candidate"],
    ["License Plate: xABC12345", "letter before candidate — adjacency"],
    ["\ud835\udfd9License Plate: ABC123", "Unicode number before label"],
    ["License Plate: ABC123\ud835\udfd9", "Unicode number after candidate"],
    ["License Plate: ABC123_", "underscore after candidate"],
    ["_License Plate: ABC123", "underscore before label"],
    ["License Plate: ABC123\u0301", "combining mark after candidate"],
    ["License  Plate: ABC123", "double space in multiword label"],
    ["License\tPlate: ABC123", "tab in multiword label"],
    // Too short — single char
    ["License Plate: A", "single char too short"],
    // All-alpha, no digit — should not match
    ["License Plate: ABC", "all alpha, no digit"],
    ["License Plate: ABCDEF", "all alpha, no digit 2"],
    // Embedded in larger word (exceeds 8-char match limit)
    ["License Plate: xABC12345x", "embedded in word"],
  ])("%s (%s)", (input) => {
    expect(redact(input)).toBe(input);
  });
});

describe("license plate detector — boundary cases", () => {
  test("trailing period is preserved", () => {
    expect(redact("License Plate: ABC123.")).toBe(
      "License Plate: [LICENSE_PLATE].",
    );
  });

  test("trailing text is preserved", () => {
    expect(redact("License Plate: ABC123 extra")).toBe(
      "License Plate: [LICENSE_PLATE] extra",
    );
  });

  test("multiple plates in one text", () => {
    expect(redact("License Plate: ABC123 and Plate Number: DEF456")).toBe(
      "License Plate: [LICENSE_PLATE] and Plate Number: [LICENSE_PLATE]",
    );
  });

  test("emoji before candidate does not shift alignment", () => {
    expect(redact("\ud83d\ude00 License Plate: ABC123")).toBe(
      "\ud83d\ude00 License Plate: [LICENSE_PLATE]",
    );
  });

  test("plate at start of string with following context", () => {
    expect(redact("ABC123 (License Plate)")).toBe(
      "[LICENSE_PLATE] (License Plate)",
    );
  });

  test("plate at end of string with preceding context", () => {
    expect(redact("License Plate: ABC123")).toBe(
      "License Plate: [LICENSE_PLATE]",
    );
  });
});

describe("license plate detector — inspection", () => {
  test("detect returns correct spans, ruleId, entityType, reasons", () => {
    const result = detect("License Plate: ABC123");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      start: 15,
      end: 21,
      ruleId: "license_plate",
      entityType: "license_plate",
      reasons: ["license_plate.format", "license_plate.context"],
    });
  });

  test("detect for UK plate format", () => {
    const result = detect("License Plate: AB12CDE");
    expect(result).toHaveLength(1);
    expect(result[0]?.start).toBe(15);
    expect(result[0]?.end).toBe(22);
  });

  test("detect for CA plate format with hyphen", () => {
    const result = detect("License Plate: A1B-2C3");
    expect(result).toHaveLength(1);
    expect(result[0]?.start).toBe(15);
    expect(result[0]?.end).toBe(22);
  });

  test("detect for following context", () => {
    const result = detect("ABC123 (License Plate)");
    expect(result).toHaveLength(1);
    expect(result[0]?.start).toBe(0);
    expect(result[0]?.end).toBe(6);
  });

  test("detect for multiple matches", () => {
    const result = detect("License Plate: ABC123 and License Plate: DEF456");
    expect(result).toHaveLength(2);
    expect(result[0]?.start).toBe(15);
    expect(result[0]?.end).toBe(21);
    expect(result[1]?.start).toBe(41);
    expect(result[1]?.end).toBe(47);
  });
});

describe("license plate detector — adversarial", () => {
  test("does not match all-alpha sequences with context", () => {
    expect(redact("License Plate: ABCDEFGH")).toBe("License Plate: ABCDEFGH");
  });

  test("does not match random text without context", () => {
    expect(redact("The quick brown fox ABC123 jumps")).toBe(
      "The quick brown fox ABC123 jumps",
    );
  });

  test("does not match phone numbers with context", () => {
    expect(redact("License Plate: 123-456-7890")).toBe(
      "License Plate: [LICENSE_PLATE]-456-7890",
    );
  });

  test("handles empty string", () => {
    expect(detect("")).toHaveLength(0);
  });

  test("handles string with no alphanumeric characters", () => {
    expect(detect("!@#$%^&*()")).toHaveLength(0);
  });

  test("context label must be whole word", () => {
    expect(redact("XLicense Plate: ABC123")).toBe("XLicense Plate: ABC123");
    expect(redact("License PlateX: ABC123")).toBe("License PlateX: ABC123");
  });

  test("does not redact already-redacted text", () => {
    expect(redact("License Plate: [LICENSE_PLATE]")).toBe(
      "License Plate: [LICENSE_PLATE]",
    );
  });
});
