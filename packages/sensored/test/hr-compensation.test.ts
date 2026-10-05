import { describe, expect, test } from "bun:test";
import { hrCompensationDetector } from "../src/detectors/hr/hr-compensation";

describe("HR compensation detector", () => {
  test.each([
    ["Salary: $50,000.00", 8, 18],
    ["Compensation: $75,000", 14, 21],
    ["Pay: $1,234.56", 5, 14],
    ["Wage: $15.50", 6, 12],
    ["Earning: $100,000.00", 9, 20],
    ["Benefits Plan No: BP123456", 18, 26],
    ["Insurance Plan ID: INS123456", 19, 28],
    ["Health-Plan No: HP123456", 16, 24],
    ["401K Account No: RET123456789012", 17, 32],
    ["403B No: 403B12345678", 9, 21],
    ["IRA No: IRA123456789012", 8, 23],
    ["Retirement Account No: RT123456789012", 23, 37],
    ["Pension No: PN123456789012", 12, 26],
    ["salary: $50,000.00", 8, 18],
    ["SALARY: $50,000.00", 8, 18],
    ["Salary:$50,000.00", 7, 17],
    ["Salary: $ 50,000.00", 8, 19],
    ["Salary: £50,000.00", 8, 18],
    ["Salary: €50,000.00", 8, 18],
    ["Salary: ¥50000", 8, 14],
    ["50000.00 (Salary)", 0, 8],
    ["50000.00 Salary", 0, 8],
  ])("positive: %s", (input, start, end) => {
    const detections = hrCompensationDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "hr_compensation",
      entityType: "hr_compensation",
      reasons: ["hr_compensation.format", "hr_compensation.context"],
    });
  });

  test.each([
    ["Reference: $50,000.00", "wrong context label"],
    ["$50,000.00", "no context"],
    ["mySalary: $50,000.00", "label not whole — my prefix"],
    ["Salaryx: $50,000.00", "label not whole — x suffix"],
    ["Salary:\n$50,000.00", "newline between label and candidate"],
    ["Salary:         $50,000.00", "9 spaces exceeds 0-8"],
    ["$50,000.00(Salary)", "0 spaces before paren — following requires 1-8"],
    ["$50,000.00 (Salary", "missing closing paren"],
    ["$50,000.00x (Salary)", "letter after candidate before following label"],
    ["Salary: $50,000.00_", "underscore after candidate"],
    ["_Salary: $50,000.00", "underscore before label"],
    ["Salary: $50,000.00\u0301", "combining mark after candidate"],
    ["x$50,000.00", "embedded before"],
    ["$50,000.00x", "embedded after"],
  ])("negative: %s (%s)", (input) => {
    const detections = hrCompensationDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Salary: $50,000.00 and 401K Account No: RET123456789012";
    const detections = hrCompensationDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(8);
    expect(detections[0]?.end).toBe(18);
    expect(detections[1]?.start).toBe(40);
    expect(detections[1]?.end).toBe(55);
  });

  test("monetary and plan ID in same string", () => {
    const text = "Salary: $50,000.00 and Benefits Plan No: BP123456";
    const detections = hrCompensationDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(8);
    expect(detections[0]?.end).toBe(18);
    expect(detections[1]?.start).toBe(41);
    expect(detections[1]?.end).toBe(49);
  });

  test("detector metadata", () => {
    expect(hrCompensationDetector.id).toBe("hr_compensation");
    expect(hrCompensationDetector.entityType).toBe("hr_compensation");
    expect(hrCompensationDetector.replacement).toBe("[HR_COMPENSATION]");
    expect(hrCompensationDetector.stream).toEqual({
      maxMatchLength: 30,
      leftContext: 40,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });

  test("emoji before candidate does not shift alignment", () => {
    const detections = hrCompensationDetector.detect(
      "\ud83d\ude00 Salary: $50,000.00",
    );
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(11);
    expect(detections[0]?.end).toBe(21);
  });
});
