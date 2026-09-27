import { describe, expect, test } from "bun:test";
import { idNpwpDetector } from "../src/detectors/national-id/id-npwp";

const MATCH_FORMATTED = "12.345.678.9-012.345";
const MATCH_COMPACT = "123456789012345";

describe("Indonesia NPWP detector — positive cases", () => {
  test.each([
    "NPWP: 12.345.678.9-012.345",
    "NPWP: 123456789012345",
    "Indonesia NPWP: 12.345.678.9-012.345",
    "Tax NPWP: 12.345.678.9-012.345",
    "Pajak: 12.345.678.9-012.345",
    "Wajib Pajak: 12.345.678.9-012.345",
    "NPWP:123456789012345",
    "NPWP# 12.345.678.9-012.345",
    "npwp: 12.345.678.9-012.345",
    "NPWP:\t12.345.678.9-012.345",
    "12.345.678.9-012.345 (NPWP)",
    "12.345.678.9-012.345 NPWP",
    "123456789012345 (NPWP)",
    "NPWP: 12.345.678.9-012.345.",
    "(NPWP: 12.345.678.9-012.345)",
  ])("%s", (input) => {
    const detections = idNpwpDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "id_npwp",
      entityType: "id_npwp",
      reasons: ["id_npwp.format", "id_npwp.context"],
    });
    const match = input.includes(MATCH_FORMATTED)
      ? MATCH_FORMATTED
      : MATCH_COMPACT;
    expect(detections[0]?.start).toBe(input.indexOf(match));
    expect(detections[0]?.end).toBe(input.indexOf(match) + match.length);
  });

  test("multiple NPWPs in one text", () => {
    const text = "NPWP: 12.345.678.9-012.345 and NPWP: 98.765.432.1-098.765";
    const detections = idNpwpDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(6);
    expect(detections[1]?.start).toBe(37);
  });
});

describe("Indonesia NPWP detector — negative cases", () => {
  test.each([
    ["12.345.678.9-012.345", "no context"],
    ["Reference: 12.345.678.9-012.345", "non-approved label"],
    ["myNPWP: 12.345.678.9-012.345", "label not whole — my prefix"],
    ["NPWPx: 12.345.678.9-012.345", "label not whole — x suffix"],
    ["NPWP:\n12.345.678.9-012.345", "newline between label and candidate"],
    ["NPWP:         12.345.678.9-012.345", "9 spaces exceeds 0-8"],
    ["12.345.678.9-012.345(NPWP)", "0 spaces before paren"],
    ["12.345.678.9-012.345 (NPWP", "missing closing paren"],
    ["12.345.678.9-012.345x (NPWP)", "letter after candidate before label"],
    ["NPWP: 12.345.678.9-012.345_", "underscore after candidate"],
    ["_NPWP: 12.345.678.9-012.345", "underscore before label"],
  ])("%s (%s)", (input) => {
    const detections = idNpwpDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("Indonesia NPWP detector — boundary cases", () => {
  test("trailing period is preserved", () => {
    const text = "NPWP: 12.345.678.9-012.345.";
    const detections = idNpwpDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.end).toBe(
      text.indexOf(MATCH_FORMATTED) + MATCH_FORMATTED.length,
    );
  });

  test("compact format without separators", () => {
    const text = "NPWP: 123456789012345";
    const detections = idNpwpDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(6);
    expect(detections[0]?.end).toBe(21);
  });

  test("dot separator instead of dash", () => {
    const text = "NPWP: 12.345.678.9.012.345";
    const detections = idNpwpDetector.detect(text);
    expect(detections).toHaveLength(1);
  });

  test("candidate at start with following context", () => {
    const text = "12.345.678.9-012.345 (NPWP)";
    const detections = idNpwpDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(0);
  });
});

describe("Indonesia NPWP detector — adversarial cases", () => {
  test("emoji before candidate does not shift alignment", () => {
    const text = "\ud83d\ude00 NPWP: 12.345.678.9-012.345";
    const detections = idNpwpDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(text.indexOf(MATCH_FORMATTED));
  });

  test("Unicode number after candidate", () => {
    const text = "NPWP: 12.345.678.9-012.345\ud835\udfd9";
    const detections = idNpwpDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("combining mark after candidate", () => {
    const text = "NPWP: 12.345.678.9-012.345\u0301";
    const detections = idNpwpDetector.detect(text);
    expect(detections).toHaveLength(0);
  });
});
