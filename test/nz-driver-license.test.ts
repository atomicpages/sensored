import { describe, expect, test } from "bun:test";
import { nzDriverLicenseDetector } from "../src/detectors/national-id/nz-driver-license";

describe("New Zealand Driver License detector", () => {
  test.each([
    ["Driver License: AB123456", 16, 24],
    ["Driver Licence: AB123456", 16, 24],
    ["License: AB123456", 9, 17],
    ["Licence: AB123456", 9, 17],
    ["New Zealand Driver License: AB123456", 28, 36],
    ["NZ Driver License: AB123456", 19, 27],
    ["Kiwi Driver License: AB123456", 21, 29],
    ["Driver: AB123456", 8, 16],
    ["Driver License:AB123456", 15, 23],
    ["Driver License# AB123456", 16, 24],
    ["Driver License#AB123456", 15, 23],
    ["driver license: ab123456", 16, 24],
    ["DRIVER LICENSE: AB123456", 16, 24],
    ["Driver License:\tAB123456", 16, 24],
    ["Driver License: \t AB123456", 18, 26],
    ["AB123456 (Driver License)", 0, 8],
    ["AB123456 Driver License", 0, 8],
    ["AB123456\t(Driver License)", 0, 8],
    ["Driver License: AB123456.", 16, 24],
    ["(Driver License: AB123456)", 17, 25],
  ])("positive: %s", (input, start, end) => {
    const detections = nzDriverLicenseDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "nz_driver_license",
      entityType: "nz_driver_license",
      reasons: ["nz_driver_license.format", "nz_driver_license.context"],
    });
  });

  test.each([
    ["AB123456", "no context"],
    ["Reference: AB123456", "non-approved label"],
    ["myDriver: AB123456", "label not whole — my prefix"],
    ["Driverx: AB123456", "label not whole — x suffix"],
    ["Driver:\nAB123456", "newline between label and candidate"],
    ["Driver:         AB123456", "9 spaces exceeds 0-8"],
    [
      "AB123456(Driver License)",
      "0 spaces before paren — following requires 1-8",
    ],
    ["AB123456 (Driver License", "missing closing paren"],
    [
      "AB123456x (Driver License)",
      "letter after candidate before following label",
    ],
    ["Driver: AB1234567", "digit after candidate"],
    ["Driver: 0AB123456", "digit before candidate"],
    ["Driver: AB123456_", "underscore after candidate"],
    ["_Driver: AB123456", "underscore before label"],
    ["Driver: AB123456\u0301", "combining mark after candidate"],
    ["Driver: AB12345", "7 chars — too few"],
    ["Driver: AB1234567", "9 chars — too many"],
    ["Driver: A123456", "1 letter — too few"],
    ["Driver: ABC123456", "3 letters — too many"],
  ])("negative: %s (%s)", (input) => {
    const detections = nzDriverLicenseDetector.detect(input);
    expect(detections).toHaveLength(0);
  });

  test("multiple detections in one string", () => {
    const text = "Driver License: AB123456 and Driver License: CD654321";
    const detections = nzDriverLicenseDetector.detect(text);
    expect(detections).toHaveLength(2);
    expect(detections[0]?.start).toBe(16);
    expect(detections[0]?.end).toBe(24);
    expect(detections[1]?.start).toBe(45);
    expect(detections[1]?.end).toBe(53);
  });

  test("detector metadata", () => {
    expect(nzDriverLicenseDetector.id).toBe("nz_driver_license");
    expect(nzDriverLicenseDetector.entityType).toBe("nz_driver_license");
    expect(nzDriverLicenseDetector.replacement).toBe("[NZ_DRIVER_LICENSE]");
    expect(nzDriverLicenseDetector.stream).toEqual({
      maxMatchLength: 8,
      leftContext: 35,
      rightContext: 20,
      boundaryLookaround: 1,
    });
  });
});
