import { describe, expect, test } from "bun:test";
import { kzIinDetector } from "../src/detectors/national-id/kz-iin";

describe("Kazakhstan IIN detector", () => {
  test.each([
    "IIN: 890515300123",
    "Kazakhstan IIN: 890515300123",
    "Kazakh IIN: 890515300123",
    "Individual Identification: 890515300123",
    "ЖСН: 890515300123",
    "IIN:890515300123",
    "IIN# 890515300123",
    "IIN#890515300123",
    "iin: 890515300123",
    "IIN:\t890515300123",
    "890515300123 (IIN)",
    "890515300123 IIN",
    "890515300123\t(IIN)",
    "890515300123        (IIN)",
    "IIN: 890515300123.",
    "(IIN: 890515300123)",
  ])("positive: %s", (input) => {
    const detections = kzIinDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "kz_iin",
      entityType: "kz_iin",
      reasons: ["kz_iin.format", "kz_iin.context"],
    });
    expect(input.slice(detections[0]?.start, detections[0]?.end)).toMatch(
      /\d{12}/,
    );
  });

  test.each([
    ["IIN: 890015300123", "month 00 invalid"],
    ["IIN: 891315300123", "month 13 invalid"],
    ["IIN: 890500300123", "day 00 invalid"],
    ["IIN: 890532300123", "day 32 invalid"],
    ["890515300123", "no context"],
    ["Reference: 890515300123", "non-approved label"],
    ["myIIN: 890515300123", "label not whole — my prefix"],
    ["IINx: 890515300123", "label not whole — x suffix"],
    ["IIN:\n890515300123", "newline between label and candidate"],
    ["IIN:         890515300123", "9 spaces exceeds 0-8"],
    ["890515300123(IIN)", "0 spaces before paren — following requires 1-8"],
    ["890515300123 (IIN", "missing closing paren"],
    ["890515300123x (IIN)", "letter after candidate before following label"],
    ["IIN: 8905153001234", "13 digits — too many"],
    ["IIN: 89051530012", "11 digits — too few"],
    ["IIN: 890515300123_", "underscore after candidate"],
    ["_IIN: 890515300123", "underscore before label"],
    ["IIN: 890515300123\u0301", "combining mark after candidate"],
    ["IIN: 0890515300123", "digit before candidate"],
    ["IIN: 8905153001234", "digit after candidate"],
  ])("negative: %s (%s)", (input) => {
    const detections = kzIinDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "IIN: 890515300123 and IIN: 890515300456";
    const detections = kzIinDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(text.slice(detections[0]?.start, detections[0]?.end)).toBe(
      "890515300123",
    );
    expect(text.slice(detections[1]?.start, detections[1]?.end)).toBe(
      "890515300456",
    );
  });

  test("detector metadata", () => {
    expect(kzIinDetector.id).toBe("kz_iin");
    expect(kzIinDetector.entityType).toBe("kz_iin");
    expect(kzIinDetector.replacement).toBe("[KZ_IIN]");
    expect(kzIinDetector.stream).toEqual({
      maxMatchLength: 12,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
