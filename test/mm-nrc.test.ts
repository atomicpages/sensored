import { describe, expect, test } from "bun:test";
import { mmNrcDetector } from "../src/detectors/national-id/mm-nrc";

const MATCH = "12/Maung(N)123456";

describe("Myanmar NRC detector — positive cases", () => {
  test.each([
    "Myanmar NRC: 12/Maung(N)123456",
    "Burmese NRC: 12/Maung(N)123456",
    "NRC: 12/Maung(N)123456",
    "National Registration: 12/Maung(N)123456",
    "Identity: 12/Maung(N)123456",
    "NRC:12/Maung(N)123456",
    "NRC# 12/Maung(N)123456",
    "NRC#12/Maung(N)123456",
    "nrc: 12/Maung(N)123456",
    "NRC:\t12/Maung(N)123456",
    "NRC: \t 12/Maung(N)123456",
    "12/Maung(N)123456 (NRC)",
    "12/Maung(N)123456 NRC",
    "12/Maung(N)123456 (Myanmar)",
    "NRC: 12/Maung(N)123456.",
    "(NRC: 12/Maung(N)123456)",
    "NRC: 1/Yangon(C)654321",
    "NRC: 9/Mandalay(N)999999",
  ])("%s", (input) => {
    const detections = mmNrcDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "mm_nrc",
      entityType: "mm_nrc",
      reasons: ["mm_nrc.format", "mm_nrc.context"],
    });
    const match = input.includes(MATCH)
      ? MATCH
      : input.match(/\d{1,2}\/[A-Z][a-z]+\([NC]\)\d{6}/)?.[0];

    if (match === undefined) {
      throw new Error(`expected NRC match in: ${input}`);
    }

    expect(detections[0]?.start).toBe(input.indexOf(match));
    expect(detections[0]?.end).toBe(input.indexOf(match) + match.length);
  });

  test("multiple NRCs in one text", () => {
    const text = "NRC: 12/Maung(N)123456 and NRC: 9/Yangon(C)654321";
    const detections = mmNrcDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(5);
    expect(detections[1]?.start).toBe(32);
  });
});

describe("Myanmar NRC detector — negative cases", () => {
  test.each([
    ["12/Maung(N)123456", "no context"],
    ["Reference: 12/Maung(N)123456", "non-approved label"],
    ["myNRC: 12/Maung(N)123456", "label not whole — my prefix"],
    ["NRCx: 12/Maung(N)123456", "label not whole — x suffix"],
    ["NRC:\n12/Maung(N)123456", "newline between label and candidate"],
    ["NRC:         12/Maung(N)123456", "9 spaces exceeds 0-8"],
    ["12/Maung(N)123456(NRC)", "0 spaces before paren"],
    ["12/Maung(N)123456 (NRC", "missing closing paren"],
    ["12/Maung(N)123456x (NRC)", "letter after candidate before label"],
    ["NRC: 12/Maung(N)123456_", "underscore after candidate"],
    ["_NRC: 12/Maung(N)123456", "underscore before label"],
    ["NRC: 12/maung(N)123456", "township name not capitalized"],
    ["NRC: 12/Maung(X)123456", "invalid citizenship code X"],
    ["NRC: 12/Maung(N)12345", "5 digits — too short"],
    ["NRC: 12/Maung(N)1234567", "7 digits — too long"],
  ])("%s (%s)", (input) => {
    const detections = mmNrcDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("Myanmar NRC detector — boundary cases", () => {
  test("trailing period is preserved", () => {
    const text = "NRC: 12/Maung(N)123456.";
    const detections = mmNrcDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.end).toBe(text.indexOf(MATCH) + MATCH.length);
  });

  test("single digit state code", () => {
    const text = "NRC: 1/Maung(N)123456";
    const detections = mmNrcDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(5);
    expect(detections[0]?.end).toBe(21);
  });

  test("double digit state code", () => {
    const text = "NRC: 12/Maung(N)123456";
    const detections = mmNrcDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(5);
    expect(detections[0]?.end).toBe(22);
  });

  test("citizenship code C", () => {
    const text = "NRC: 12/Maung(C)123456";
    const detections = mmNrcDetector.detect(text);
    expect(detections).toHaveLength(1);
  });

  test("candidate at start with following context", () => {
    const text = "12/Maung(N)123456 (NRC)";
    const detections = mmNrcDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(0);
  });
});

describe("Myanmar NRC detector — adversarial cases", () => {
  test("emoji before candidate does not shift alignment", () => {
    const text = "\ud83d\ude00 NRC: 12/Maung(N)123456";
    const detections = mmNrcDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(text.indexOf(MATCH));
  });

  test("Unicode number after candidate", () => {
    const text = "NRC: 12/Maung(N)123456\ud835\udfd9";
    const detections = mmNrcDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("combining mark after candidate", () => {
    const text = "NRC: 12/Maung(N)123456\u0301";
    const detections = mmNrcDetector.detect(text);
    expect(detections).toHaveLength(0);
  });
});
