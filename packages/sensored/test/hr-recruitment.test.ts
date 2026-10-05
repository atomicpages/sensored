import { describe, expect, test } from "bun:test";
import { hrRecruitmentDetector } from "../src/detectors/hr/hr-recruitment";

describe("HR recruitment detector", () => {
  test.each([
    ["Application ID: APP123456", 16, 25],
    ["Candidate ID: CAND123456", 14, 24],
    ["Applicant No: APL123456", 14, 23],
    ["Application Ref: REF123456", 17, 26],
    ["Resume ID: RES123456", 11, 20],
    ["CV No: CV123456", 7, 15],
    ["Curriculum Vitae No: CV123456", 21, 29],
    ["Performance ID: PERF123456", 16, 26],
    ["Review ID: REV123456", 11, 20],
    ["Appraisal No: APP123456", 14, 23],
    ["Evaluation ID: EVAL123456", 15, 25],
    ["Training ID: TRN123456", 13, 22],
    ["Certification ID: CERT123456", 18, 28],
    ["Cert No: CT123456", 9, 17],
    ["Recruiter Ref: REC123456", 15, 24],
    ["Agency ID: AG123456", 11, 19],
    ["application id: APP123456", 16, 25],
    ["APPLICATION ID: APP123456", 16, 25],
    ["Application ID:APP123456", 15, 24],
    ["Application ID# APP123456", 16, 25],
    ["APP123456 (Application)", 0, 9],
    ["APP123456 Application", 0, 9],
  ])("positive: %s", (input, start, end) => {
    const detections = hrRecruitmentDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "hr_recruitment",
      entityType: "hr_recruitment",
      reasons: ["hr_recruitment.format", "hr_recruitment.context"],
    });
  });

  test.each([
    ["Application ID: APP123", "too short — only 6 chars"],
    ["Application ID: APP123456789012345", "too long — exceeds maxMatchLength"],
    ["Reference: APP123456", "wrong context label"],
    ["APP123456", "no context"],
    ["myApplication ID: APP123456", "label not whole — my prefix"],
    ["Application IDX: APP123456", "label not whole — x suffix"],
    ["Application ID:\nAPP123456", "newline between label and candidate"],
    ["Application ID:         APP123456", "9 spaces exceeds 0-8"],
    [
      "APP123456(Application)",
      "0 spaces before paren — following requires 1-8",
    ],
    ["APP123456 (Application", "missing closing paren"],
    ["Application ID: APP123456_", "underscore after candidate"],
    ["_Application ID: APP123456", "underscore before label"],
    ["Application ID: APP123456\u0301", "combining mark after candidate"],
    ["xAPP123456", "embedded before"],
    ["APP123456x", "embedded after"],
  ])("negative: %s (%s)", (input) => {
    const detections = hrRecruitmentDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Application ID: APP123456 and Training ID: TRN123456";
    const detections = hrRecruitmentDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(16);
    expect(detections[0]?.end).toBe(25);
    expect(detections[1]?.start).toBe(43);
    expect(detections[1]?.end).toBe(52);
  });

  test("two different labels in same string", () => {
    const text = "Application ID: APP123456 and Candidate ID: CAND123456";
    const detections = hrRecruitmentDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(16);
    expect(detections[0]?.end).toBe(25);
    expect(detections[1]?.start).toBe(44);
    expect(detections[1]?.end).toBe(54);
  });

  test("detector metadata", () => {
    expect(hrRecruitmentDetector.id).toBe("hr_recruitment");
    expect(hrRecruitmentDetector.entityType).toBe("hr_recruitment");
    expect(hrRecruitmentDetector.replacement).toBe("[HR_RECRUITMENT]");
    expect(hrRecruitmentDetector.stream).toEqual({
      maxMatchLength: 25,
      leftContext: 40,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });

  test("emoji before candidate does not shift alignment", () => {
    const detections = hrRecruitmentDetector.detect(
      "\ud83d\ude00 Application ID: APP123456",
    );
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(19);
    expect(detections[0]?.end).toBe(28);
  });
});
