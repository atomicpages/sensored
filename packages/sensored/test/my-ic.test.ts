import { describe, expect, test } from "bun:test";
import { myIcDetector } from "../src/detectors/national-id/my-ic";

const MATCH = "900101-01-1234";

describe("Malaysia MyKad detector — positive cases", () => {
  test.each([
    "Malaysia MyKad: 900101-01-1234",
    "Malaysian MyKad: 900101-01-1234",
    "MyKad: 900101-01-1234",
    "IC Number: 900101-01-1234",
    "Kad Pengenalan: 900101-01-1234",
    "MyKad:900101-01-1234",
    "MyKad# 900101-01-1234",
    "mykad: 900101-01-1234",
    "MYKAD: 900101-01-1234",
    "MyKad:\t900101-01-1234",
    "MyKad: \t 900101-01-1234",
    "900101-01-1234 (MyKad)",
    "900101-01-1234 MyKad",
    "900101-01-1234 (Malaysia)",
    "MyKad: 900101-01-1234.",
    "(MyKad: 900101-01-1234)",
    "MyKad: 900101 01 1234",
  ])("%s", (input) => {
    const detections = myIcDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "my_ic",
      entityType: "my_ic",
      reasons: ["my_ic.format", "my_ic.context"],
    });
    const match = input.includes(MATCH) ? MATCH : "900101 01 1234";
    expect(detections[0]?.start).toBe(input.indexOf(match));
    expect(detections[0]?.end).toBe(input.indexOf(match) + match.length);
  });

  test("multiple MyKads in one text", () => {
    const text = "MyKad: 900101-01-1234 and MyKad: 900202-02-5678";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(7);
    expect(detections[1]?.start).toBe(33);
  });
});

describe("Malaysia MyKad detector — validation cases", () => {
  test("valid month and day", () => {
    const text = "MyKad: 900101-01-1234";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(1);
  });

  test("invalid month 13", () => {
    const text = "MyKad: 901301-01-1234";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("invalid month 00", () => {
    const text = "MyKad: 900001-01-1234";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("invalid day 32", () => {
    const text = "MyKad: 900132-01-1234";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("invalid day 00", () => {
    const text = "MyKad: 900100-01-1234";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("valid month 12 day 31", () => {
    const text = "MyKad: 901231-01-1234";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(1);
  });
});

describe("Malaysia MyKad detector — negative cases", () => {
  test.each([
    ["900101-01-1234", "no context"],
    ["Reference: 900101-01-1234", "non-approved label"],
    ["myMyKad: 900101-01-1234", "label not whole — my prefix"],
    ["MyKadx: 900101-01-1234", "label not whole — x suffix"],
    ["MyKad:\n900101-01-1234", "newline between label and candidate"],
    ["MyKad:         900101-01-1234", "9 spaces exceeds 0-8"],
    ["900101-01-1234(MyKad)", "0 spaces before paren"],
    ["900101-01-1234 (MyKad", "missing closing paren"],
    ["900101-01-1234x (MyKad)", "letter after candidate before label"],
    ["MyKad: 900101-01-1234_", "underscore after candidate"],
    ["_MyKad: 900101-01-1234", "underscore before label"],
  ])("%s (%s)", (input) => {
    const detections = myIcDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("Malaysia MyKad detector — boundary cases", () => {
  test("trailing period is preserved", () => {
    const text = "MyKad: 900101-01-1234.";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.end).toBe(text.indexOf(MATCH) + MATCH.length);
  });

  test("space-separated format", () => {
    const text = "MyKad: 900101 01 1234";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(1);
  });

  test("compact format without separators", () => {
    const text = "MyKad: 900101011234";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(7);
    expect(detections[0]?.end).toBe(19);
  });

  test("candidate at start with following context", () => {
    const text = "900101-01-1234 (MyKad)";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(0);
  });
});

describe("Malaysia MyKad detector — adversarial cases", () => {
  test("emoji before candidate does not shift alignment", () => {
    const text = "\ud83d\ude00 MyKad: 900101-01-1234";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(text.indexOf(MATCH));
  });

  test("Unicode number after candidate", () => {
    const text = "MyKad: 900101-01-1234\ud835\udfd9";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("combining mark after candidate", () => {
    const text = "MyKad: 900101-01-1234\u0301";
    const detections = myIcDetector.detect(text);
    expect(detections).toHaveLength(0);
  });
});
