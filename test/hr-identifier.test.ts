import { describe, expect, test } from "bun:test";
import { hrIdentifierDetector } from "../src/detectors/hr/hr-identifier";

describe("HR identifier detector", () => {
  test.each([
    ["Employee ID: EMP123456", 13, 22],
    ["Employee ID: 12345678", 13, 21],
    ["EMP-ID: AB123456", 8, 16],
    ["Staff No: 12345678", 10, 18],
    ["Personnel ID: 123456", 14, 20],
    ["Worker ID: 12345678", 11, 19],
    ["Payroll No: PR123456789", 12, 23],
    ["PAY ID: 123456789", 8, 17],
    ["Timesheet No: TS123456789", 14, 25],
    ["Timecard ID: TC123456789", 13, 24],
    ["Time-Entry No: TE123456789", 15, 26],
    ["employee id: EMP123456", 13, 22],
    ["EMPLOYEE ID: EMP123456", 13, 22],
    ["Employee ID:EMP123456", 12, 21],
    ["Employee ID# 12345678", 13, 21],
    ["12345678 (Employee ID)", 0, 8],
    ["12345678 Employee ID", 0, 8],
  ])("positive: %s", (input, start, end) => {
    const detections = hrIdentifierDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "hr_identifier",
      entityType: "hr_identifier",
      reasons: ["hr_identifier.format", "hr_identifier.context"],
    });
  });

  test.each([
    ["Employee ID: 123", "too short — only 3 digits"],
    ["Employee ID: EMP12345678901234", "too long — exceeds maxMatchLength"],
    ["Reference: EMP123456", "wrong context label"],
    ["EMP123456", "no context"],
    ["myEmployee ID: EMP123456", "label not whole — my prefix"],
    ["Employee IDX: EMP123456", "label not whole — x suffix"],
    ["Employee ID:\nEMP123456", "newline between label and candidate"],
    ["Employee ID:         EMP123456", "9 spaces exceeds 0-8"],
    [
      "EMP123456(Employee ID)",
      "0 spaces before paren — following requires 1-8",
    ],
    ["EMP123456 (Employee ID", "missing closing paren"],
    [
      "EMP123456x (Employee ID)",
      "letter after candidate before following label",
    ],
    ["Employee ID: EMP123456_", "underscore after candidate"],
    ["_Employee ID: EMP123456", "underscore before label"],
    ["Employee ID: EMP123456\u0301", "combining mark after candidate"],
    ["xEMP123456", "embedded before"],
    ["EMP123456x", "embedded after"],
  ])("negative: %s (%s)", (input) => {
    const detections = hrIdentifierDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Employee ID: EMP123456 and Payroll No: PR123456789";
    const detections = hrIdentifierDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(13);
    expect(detections[0]?.end).toBe(22);
    expect(detections[1]?.start).toBe(39);
    expect(detections[1]?.end).toBe(50);
  });

  test("two identifiers with same label", () => {
    const text = "Employee ID: EMP123456 and Employee ID: EMP789012";
    const detections = hrIdentifierDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(13);
    expect(detections[0]?.end).toBe(22);
    expect(detections[1]?.start).toBe(40);
    expect(detections[1]?.end).toBe(49);
  });

  test("detector metadata", () => {
    expect(hrIdentifierDetector.id).toBe("hr_identifier");
    expect(hrIdentifierDetector.entityType).toBe("hr_identifier");
    expect(hrIdentifierDetector.replacement).toBe("[HR_IDENTIFIER]");
    expect(hrIdentifierDetector.stream).toEqual({
      maxMatchLength: 25,
      leftContext: 40,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });

  test("emoji before candidate does not shift alignment", () => {
    const detections = hrIdentifierDetector.detect(
      "\ud83d\ude00 Employee ID: EMP123456",
    );
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(16);
    expect(detections[0]?.end).toBe(25);
  });
});
