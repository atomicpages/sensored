import { describe, expect, test } from "bun:test";
import { emailDetector } from "../src/detectors/contact/email";
import { ngBvnDetector } from "../src/detectors/national-id/ng-bvn";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: ngBvnDetector, setting: { action: "redact" } },
]);

describe("Nigeria BVN complete-string processing", () => {
  test.each([
    ["BVN: 12345678901", "BVN: [NG_BVN]"],
    ["Bank Verification: 12345678901", "Bank Verification: [NG_BVN]"],
    ["Nigeria: 12345678901", "Nigeria: [NG_BVN]"],
    ["Nigerian: 12345678901", "Nigerian: [NG_BVN]"],
    ["Banking: 12345678901", "Banking: [NG_BVN]"],
    ["BVN:12345678901", "BVN:[NG_BVN]"],
    ["BVN# 12345678901", "BVN# [NG_BVN]"],
    ["BVN#12345678901", "BVN#[NG_BVN]"],
    ["12345678901 (BVN)", "[NG_BVN] (BVN)"],
    ["12345678901 BVN", "[NG_BVN] BVN"],
    ["12345678901 (Bank Verification)", "[NG_BVN] (Bank Verification)"],
    ["12345678901 (Nigeria)", "[NG_BVN] (Nigeria)"],
    ["bvn: 12345678901", "bvn: [NG_BVN]"],
    ["BANKING: 12345678901", "BANKING: [NG_BVN]"],
    ["BVN:        12345678901", "BVN:        [NG_BVN]"],
    ["BVN:\t12345678901", "BVN:\t[NG_BVN]"],
    ["BVN: \t 12345678901", "BVN: \t [NG_BVN]"],
    ["12345678901\t(BVN)", "[NG_BVN]\t(BVN)"],
    ["12345678901        (BVN)", "[NG_BVN]        (BVN)"],
    [
      "BVN: 12345678901 and BVN: 98765432109",
      "BVN: [NG_BVN] and BVN: [NG_BVN]",
    ],
    ["BVN: 12345678901.", "BVN: [NG_BVN]."],
    ["(BVN: 12345678901)", "(BVN: [NG_BVN])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 12345678901", "non-approved label"],
    ["12345678901", "no label"],
    ["myBVN: 12345678901", "label not whole — my prefix"],
    ["BVNx: 12345678901", "label not whole — x suffix"],
    ["BVN:\n12345678901", "newline between label and candidate"],
    ["BVN:         12345678901", "9 spaces exceeds 0-8"],
    ["12345678901(BVN)", "0 spaces before paren — following requires 1-8"],
    ["12345678901 (BVN", "missing closing paren"],
    ["12345678901x (BVN)", "letter after candidate before following label"],
    ["BVN: 123456789010", "digit after candidate"],
    ["BVN: 012345678901", "digit before candidate"],
    ["BVN: 12345678901_", "underscore after candidate"],
    ["_BVN: 12345678901", "underscore before label"],
    ["BVN: 12345678901\u0301", "combining mark after candidate"],
    ["BVN: 1234567890", "10 digits — too few"],
    ["BVN: 123456789012", "12 digits — too many"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("BVN: 12345678901");
    expect(result.text).toBe("BVN: [NG_BVN]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "12345678901",
      ruleId: "ng_bvn",
      entityType: "ng_bvn",
      reasons: ["ng_bvn.format", "ng_bvn.context"],
    });
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(16);
  });

  test("inspection for following context", () => {
    const result = redactor.inspect("12345678901 (BVN)");
    expect(result.text).toBe("[NG_BVN] (BVN)");
    expect(result.groups[0]?.matches[0]?.value).toBe("12345678901");
    expect(result.groups[0]?.start).toBe(0);
    expect(result.groups[0]?.end).toBe(11);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor([
      {
        detector: ngBvnDetector,
        setting: { action: "mask", preserve: { last: 4 } },
      },
    ]);
    expect(masker.redact("BVN: 12345678901")).toBe("BVN: *******8901");
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor([
      { detector: ngBvnDetector, setting: { action: "remove" } },
    ]);
    expect(remover.redact("BVN: 12345678901")).toBe("BVN: ");
    expect(remover.redact("12345678901 (BVN)")).toBe(" (BVN)");
  });

  test("coexists with email detector", () => {
    const both = makeRedactor([
      { detector: emailDetector, setting: { action: "redact" } },
      { detector: ngBvnDetector, setting: { action: "redact" } },
    ]);
    expect(both.redact("Email: alice@example.com BVN: 12345678901")).toBe(
      "Email: [EMAIL] BVN: [NG_BVN]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const setting = { action: "redact" as const };
    const instance = makeRedactor([{ detector: ngBvnDetector, setting }]);
    expect(Object.isFrozen(instance.policy.ng_bvn)).toBe(true);
    expect(instance.policy.ng_bvn).not.toBe(setting);
  });
});
