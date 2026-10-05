import { describe, expect, test } from "bun:test";
import { financialReferenceDetector } from "../src/detectors/financial/financial-reference";

describe("financial_reference detector — positive cases", () => {
  test.each([
    ["Financial TXN ID: ABC123456789", 10, 30],
    ["Banking TX NO: A1B2C3D4E5", 8, 25],
    ["Financial Transaction REF: XY9876543210", 10, 39],
    ["Banking WIRE REF: ABC123456789", 8, 30],
    ["Financial TRANSFER NO: 12345678ABCD", 10, 35],
    ["Banking REMITTANCE ID: REF123456789", 8, 35],
    ["Financial STATEMENT REF: ABC123456", 10, 34],
    ["Banking STMT NO: 123456AB", 8, 25],
    ["Financial PAYMENT REF: ABC123456789", 10, 35],
    ["Banking PAY ID: 12345678AB", 8, 26],
    ["Financial TXN:ABC123456789", 10, 26],
    ["Banking TXN# ABC123456789", 8, 25],
    ["Financial TXN-REF: ABC123456789", 10, 31],
  ])("%s", (input, start, end) => {
    const detections = financialReferenceDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "financial_reference",
      entityType: "financial_reference",
      reasons: ["financial_reference.format", "financial_reference.context"],
    });
  });
});

describe("financial_reference detector — negative cases", () => {
  test.each([
    ["ABC123456789", "no context label"],
    ["Reference: ABC123456789", "non-approved label"],
    ["Financial TXN ID: ABC123", "too short — 6 chars"],
    ["Banking TXN: 12345", "too short for TXN pattern"],
    ["myFinancial TXN ID: ABC123456789", "label not whole — my prefix"],
    ["Banking WIRE REF: ABC123", "too short for WIRE pattern"],
    [
      "Financial STATEMENT REF: ABC12",
      "too short for STATEMENT pattern — 5 chars",
    ],
    ["Banking PAY REF: ABC123", "too short for PAY pattern"],
  ])("%s (%s)", (input) => {
    const detections = financialReferenceDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("financial_reference detector — boundary cases", () => {
  test("exactly 8 chars for TXN pattern", () => {
    const detections = financialReferenceDetector.detect(
      "Financial TXN ID: ABC12345",
    );
    expect(detections).toHaveLength(1);
  });

  test("exactly 20 chars for TXN pattern", () => {
    const detections = financialReferenceDetector.detect(
      "Financial TXN ID: ABCDEFGHIJKLMNOPQRST",
    );
    expect(detections).toHaveLength(1);
  });

  test("exactly 6 chars for STATEMENT pattern", () => {
    const detections = financialReferenceDetector.detect(
      "Banking STMT NO: ABC123",
    );
    expect(detections).toHaveLength(1);
  });

  test("exactly 15 chars for STATEMENT pattern", () => {
    const detections = financialReferenceDetector.detect(
      "Banking STMT NO: ABCDEFGHIJKLMNO",
    );
    expect(detections).toHaveLength(1);
  });

  test("7 chars does not match STATEMENT pattern", () => {
    const detections = financialReferenceDetector.detect(
      "Banking STMT NO: ABCDEFGHIJKLMNOP",
    );
    expect(detections).toHaveLength(0);
  });

  test("multiple matches in same text", () => {
    const text =
      "Financial TXN ID: ABC123456789; Banking WIRE REF: XYZ9876543210";
    const detections = financialReferenceDetector.detect(text);
    expect(detections).toHaveLength(2);
  });
});

describe("financial_reference detector — adversarial cases", () => {
  test("embedded in larger word — not matched", () => {
    const detections = financialReferenceDetector.detect(
      "xFinancial TXN ID: ABC123456789",
    );
    expect(detections).toHaveLength(0);
  });

  test("trailing letter after max length — not matched", () => {
    const detections = financialReferenceDetector.detect(
      "Financial TXN ID: ABCDEFGHIJKLMNOPQRSTU",
    );
    expect(detections).toHaveLength(0);
  });

  test("underscore adjacent — not matched", () => {
    const detections = financialReferenceDetector.detect(
      "Financial TXN ID: _ABC123456789",
    );
    expect(detections).toHaveLength(0);
  });

  test("empty string", () => {
    const detections = financialReferenceDetector.detect("");
    expect(detections).toHaveLength(0);
  });

  test("context label only, no reference number", () => {
    const detections = financialReferenceDetector.detect("Financial TXN ID: ");
    expect(detections).toHaveLength(0);
  });
});
