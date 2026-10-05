import { describe, expect, test } from "bun:test";
import { cardDataDetector } from "../src/detectors/financial/card-data";

const TRACK1 = "%B4242424242424242^DOE/JOHN^2512101000000?";
const TRACK2 = ";4242424242424242=2512101000000?";

describe("card_data detector — positive cases", () => {
  test.each([
    [`Card: ${TRACK1}`, 6, 6 + TRACK1.length],
    [`Card: ${TRACK2}`, 6, 6 + TRACK2.length],
    ["Card CVV: 123", 5, 13],
    ["Payment CVC: 4567", 8, 17],
    ["Credit CVV2: 123", 7, 16],
    ["Debit CID: 999", 6, 14],
    ["Visa CSC: 1234", 5, 14],
    ["Card EXP: 12/25", 5, 15],
    ["Payment EXPIRY: 12-2025", 8, 23],
    ["Credit EXPIRATION: 06/26", 7, 24],
    ["Card VALID THRU: 11/27", 5, 22],
  ])("%s", (input, start, end) => {
    const detections = cardDataDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "card_data",
      entityType: "card_data",
      reasons: ["card_data.format", "card_data.context"],
    });
  });
});

describe("card_data detector — negative cases", () => {
  test.each([
    ["CVV: 12", "too short — 2 digits"],
    ["CVV: 12345", "too long — 5 digits"],
    ["EXP: 1/25", "month too short"],
    ["EXP: 123/25", "month too long"],
    ["123", "no context label"],
    ["Reference: CVV: 123", "non-approved label"],
  ])("%s (%s)", (input) => {
    const detections = cardDataDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("card_data detector — boundary cases", () => {
  test("CVV exactly 3 digits", () => {
    const detections = cardDataDetector.detect("Card CVV: 123");
    expect(detections).toHaveLength(1);
  });

  test("CVV exactly 4 digits", () => {
    const detections = cardDataDetector.detect("Card CVV: 1234");
    expect(detections).toHaveLength(1);
  });

  test("EXP with 2-digit year", () => {
    const detections = cardDataDetector.detect("Card EXP: 12/25");
    expect(detections).toHaveLength(1);
  });

  test("EXP with 4-digit year", () => {
    const detections = cardDataDetector.detect("Card EXP: 12-2025");
    expect(detections).toHaveLength(1);
  });

  test("Track 1 minimum 13-digit PAN", () => {
    const track = "%B4242424242424^DOE/JOHN^2512101000000?";
    const detections = cardDataDetector.detect(`Card: ${track}`);
    expect(detections).toHaveLength(1);
  });

  test("Track 1 maximum 19-digit PAN", () => {
    const track = "%B4242424242424242424^DOE/JOHN^2512101000000?";
    const detections = cardDataDetector.detect(`Card: ${track}`);
    expect(detections).toHaveLength(1);
  });

  test("Track 2 minimum 13-digit PAN", () => {
    const track = ";4242424242424=2512101000000?";
    const detections = cardDataDetector.detect(`Card: ${track}`);
    expect(detections).toHaveLength(1);
  });

  test("multiple matches in same text", () => {
    const text = "Card CVV: 123 and Card EXP: 12/25";
    const detections = cardDataDetector.detect(text);
    expect(detections).toHaveLength(2);
  });
});

describe("card_data detector — adversarial cases", () => {
  test("embedded in larger word — not matched", () => {
    const detections = cardDataDetector.detect("xCard CVV: 123");
    expect(detections).toHaveLength(0);
  });

  test("trailing letter on CVV — not matched", () => {
    const detections = cardDataDetector.detect("Card CVV: 123x");
    expect(detections).toHaveLength(0);
  });

  test("underscore adjacent — not matched", () => {
    const detections = cardDataDetector.detect("Card CVV: _123");
    expect(detections).toHaveLength(0);
  });

  test("empty string", () => {
    const detections = cardDataDetector.detect("");
    expect(detections).toHaveLength(0);
  });

  test("context label only, no card data", () => {
    const detections = cardDataDetector.detect("Card CVV: ");
    expect(detections).toHaveLength(0);
  });
});
