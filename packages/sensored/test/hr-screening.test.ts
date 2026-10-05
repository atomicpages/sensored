import { describe, expect, test } from "bun:test";
import { hrScreeningDetector } from "../src/detectors/hr/hr-screening";

describe("HR screening detector", () => {
  test.each([
    ["Background Check ID: BC12345678", 21, 31],
    ["BGC ID: BG12345678", 8, 18],
    ["Screening ID: SC12345678", 14, 24],
    ["Drug Test ID: DT12345678", 14, 24],
    ["Urinalysis ID: UA12345678", 15, 25],
    ["Disciplinary Action No: DA123456", 24, 32],
    ["Incident No: IN123456", 13, 21],
    ["Warning No: WN123456", 12, 20],
    ["Violation No: VI123456", 14, 22],
    ["background check id: BC12345678", 21, 31],
    ["BACKGROUND CHECK ID: BC12345678", 21, 31],
    ["Screening ID:SC12345678", 13, 23],
    ["Screening ID# SC12345678", 14, 24],
    ["BC12345678 (Background Check)", 0, 10],
    ["BC12345678 Background Check", 0, 10],
  ])("positive: %s", (input, start, end) => {
    const detections = hrScreeningDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "hr_screening",
      entityType: "hr_screening",
      reasons: ["hr_screening.format", "hr_screening.context"],
    });
  });

  test.each([
    ["Background Check ID: BC1234", "too short — only 6 chars"],
    [
      "Background Check ID: BC123456789012345",
      "too long — exceeds maxMatchLength",
    ],
    ["Reference: BC12345678", "wrong context label"],
    ["BC12345678", "no context"],
    ["myBackground Check ID: BC12345678", "label not whole — my prefix"],
    ["Background Check IDX: BC12345678", "label not whole — x suffix"],
    ["Background Check ID:\nBC12345678", "newline between label and candidate"],
    ["Background Check ID:         BC12345678", "9 spaces exceeds 0-8"],
    [
      "BC12345678(Background Check)",
      "0 spaces before paren — following requires 1-8",
    ],
    ["BC12345678 (Background Check", "missing closing paren"],
    ["Background Check ID: BC12345678_", "underscore after candidate"],
    ["_Background Check ID: BC12345678", "underscore before label"],
    ["Background Check ID: BC12345678\u0301", "combining mark after candidate"],
    ["xBC12345678", "embedded before"],
    ["BC12345678x", "embedded after"],
  ])("negative: %s (%s)", (input) => {
    const detections = hrScreeningDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Background Check ID: BC12345678 and Drug Test ID: DT12345678";
    const detections = hrScreeningDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(21);
    expect(detections[0]?.end).toBe(31);
    expect(detections[1]?.start).toBe(50);
    expect(detections[1]?.end).toBe(60);
  });

  test("two different labels in same string", () => {
    const text = "Background Check ID: BC12345678 and Screening ID: SC12345678";
    const detections = hrScreeningDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(21);
    expect(detections[0]?.end).toBe(31);
    expect(detections[1]?.start).toBe(50);
    expect(detections[1]?.end).toBe(60);
  });

  test("detector metadata", () => {
    expect(hrScreeningDetector.id).toBe("hr_screening");
    expect(hrScreeningDetector.entityType).toBe("hr_screening");
    expect(hrScreeningDetector.replacement).toBe("[HR_SCREENING]");
    expect(hrScreeningDetector.stream).toEqual({
      maxMatchLength: 25,
      leftContext: 40,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });

  test("emoji before candidate does not shift alignment", () => {
    const detections = hrScreeningDetector.detect(
      "\ud83d\ude00 Screening ID: SC12345678",
    );
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(17);
    expect(detections[0]?.end).toBe(27);
  });
});
