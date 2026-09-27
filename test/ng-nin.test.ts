import { describe, expect, test } from "bun:test";
import { emailDetector } from "../src/detectors/contact/email";
import { ngNinDetector } from "../src/detectors/national-id/ng-nin";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: ngNinDetector, setting: { action: "redact" } },
]);

describe("Nigeria NIN complete-string processing", () => {
  test.each([
    ["NIN: 12345678901", "NIN: [NG_NIN]"],
    ["National ID: 12345678901", "National ID: [NG_NIN]"],
    ["Identity: 12345678901", "Identity: [NG_NIN]"],
    ["Nigeria: 12345678901", "Nigeria: [NG_NIN]"],
    ["Nigerian: 12345678901", "Nigerian: [NG_NIN]"],
    ["NIN:12345678901", "NIN:[NG_NIN]"],
    ["NIN# 12345678901", "NIN# [NG_NIN]"],
    ["NIN#12345678901", "NIN#[NG_NIN]"],
    ["12345678901 (NIN)", "[NG_NIN] (NIN)"],
    ["12345678901 NIN", "[NG_NIN] NIN"],
    ["12345678901 (National ID)", "[NG_NIN] (National ID)"],
    ["12345678901 (Nigeria)", "[NG_NIN] (Nigeria)"],
    ["nin: 12345678901", "nin: [NG_NIN]"],
    ["NIGERIA: 12345678901", "NIGERIA: [NG_NIN]"],
    ["NIN:        12345678901", "NIN:        [NG_NIN]"],
    ["NIN:\t12345678901", "NIN:\t[NG_NIN]"],
    ["NIN: \t 12345678901", "NIN: \t [NG_NIN]"],
    ["12345678901\t(NIN)", "[NG_NIN]\t(NIN)"],
    ["12345678901        (NIN)", "[NG_NIN]        (NIN)"],
    [
      "NIN: 12345678901 and NIN: 98765432109",
      "NIN: [NG_NIN] and NIN: [NG_NIN]",
    ],
    ["NIN: 12345678901.", "NIN: [NG_NIN]."],
    ["(NIN: 12345678901)", "(NIN: [NG_NIN])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: 12345678901", "non-approved label"],
    ["12345678901", "no label"],
    ["myNIN: 12345678901", "label not whole — my prefix"],
    ["NINx: 12345678901", "label not whole — x suffix"],
    ["NIN:\n12345678901", "newline between label and candidate"],
    ["NIN:         12345678901", "9 spaces exceeds 0-8"],
    ["12345678901(NIN)", "0 spaces before paren — following requires 1-8"],
    ["12345678901 (NIN", "missing closing paren"],
    ["12345678901x (NIN)", "letter after candidate before following label"],
    ["NIN: 123456789010", "digit after candidate"],
    ["NIN: 012345678901", "digit before candidate"],
    ["NIN: 12345678901_", "underscore after candidate"],
    ["_NIN: 12345678901", "underscore before label"],
    ["NIN: 12345678901\u0301", "combining mark after candidate"],
    ["NIN: 1234567890", "10 digits — too few"],
    ["NIN: 123456789012", "12 digits — too many"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("NIN: 12345678901");
    expect(result.text).toBe("NIN: [NG_NIN]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "12345678901",
      ruleId: "ng_nin",
      entityType: "ng_nin",
      reasons: ["ng_nin.format", "ng_nin.context"],
    });
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(16);
  });

  test("inspection for following context", () => {
    const result = redactor.inspect("12345678901 (NIN)");
    expect(result.text).toBe("[NG_NIN] (NIN)");
    expect(result.groups[0]?.matches[0]?.value).toBe("12345678901");
    expect(result.groups[0]?.start).toBe(0);
    expect(result.groups[0]?.end).toBe(11);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor([
      {
        detector: ngNinDetector,
        setting: { action: "mask", preserve: { last: 4 } },
      },
    ]);
    expect(masker.redact("NIN: 12345678901")).toBe("NIN: *******8901");
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor([
      { detector: ngNinDetector, setting: { action: "remove" } },
    ]);
    expect(remover.redact("NIN: 12345678901")).toBe("NIN: ");
    expect(remover.redact("12345678901 (NIN)")).toBe(" (NIN)");
  });

  test("coexists with email detector", () => {
    const both = makeRedactor([
      { detector: emailDetector, setting: { action: "redact" } },
      { detector: ngNinDetector, setting: { action: "redact" } },
    ]);
    expect(both.redact("Email: alice@example.com NIN: 12345678901")).toBe(
      "Email: [EMAIL] NIN: [NG_NIN]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const setting = { action: "redact" as const };
    const instance = makeRedactor([{ detector: ngNinDetector, setting }]);
    expect(Object.isFrozen(instance.policy.ng_nin)).toBe(true);
    expect(instance.policy.ng_nin).not.toBe(setting);
  });
});
