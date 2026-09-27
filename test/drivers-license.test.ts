import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { drivers_license: { action: "redact" } },
});

describe("drivers-license complete-string processing", () => {
  test.each([
    ["DL: 123456789", "DL: [DRIVERS_LICENSE]"],
    ["Driver's License: A123456789", "Driver's License: [DRIVERS_LICENSE]"],
    ["License No.: D12345678", "License No.: [DRIVERS_LICENSE]"],
    ["Driving Licence: SMITH123456AB123", "Driving Licence: [DRIVERS_LICENSE]"],
    ["DL: 12345678", "DL: [DRIVERS_LICENSE]"],
    ["DL: 123456789012", "DL: [DRIVERS_LICENSE]"],
    ["dl: 123456789", "dl: [DRIVERS_LICENSE]"],
    [
      "DL: 123456789 and DL: 987654321",
      "DL: [DRIVERS_LICENSE] and DL: [DRIVERS_LICENSE]",
    ],
    ["before DL: 123456789 after", "before DL: [DRIVERS_LICENSE] after"],
    ["DL: 123456789.", "DL: [DRIVERS_LICENSE]."],
    ["(DL: 123456789)", "(DL: [DRIVERS_LICENSE])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["123456789", "no context"],
    ["My number is 123456789", "wrong context"],
    ["DL: 12345", "too short"],
    ["DL: 1234567890123456789", "too long"],
    ["x123456789", "embedded before"],
    ["123456789x", "embedded after"],
    ["_123456789", "embedded underscore before"],
    ["DL: 123456789_", "embedded underscore after"],
    ["DL: 12345678901234567", "17 chars too long"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("DL: 123456789");
    expect(result.text).toBe("DL: [DRIVERS_LICENSE]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "123456789",
      ruleId: "drivers_license",
      entityType: "drivers_license",
      reasons: ["drivers_license.format", "drivers_license.context"],
    });
    expect(result.groups[0]?.start).toBe(4);
    expect(result.groups[0]?.end).toBe(13);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        drivers_license: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("DL: 123456789")).toBe("DL: *****6789");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { drivers_license: { action: "remove" } },
    });
    expect(remover.redact("DL: 123456789")).toBe("DL: ");
  });

  test("coexists with email detector", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        drivers_license: { action: "redact" },
      },
    });
    expect(both.redact("Email: alice@example.com DL: 123456789")).toBe(
      "Email: [EMAIL] DL: [DRIVERS_LICENSE]",
    );
  });

  test("multiple licenses in text", () => {
    expect(redactor.redact("DL: 123456789 DL: 987654321")).toBe(
      "DL: [DRIVERS_LICENSE] DL: [DRIVERS_LICENSE]",
    );
  });

  test("emoji before candidate does not shift alignment", () => {
    expect(redactor.redact("\ud83d\ude00 DL: 123456789")).toBe(
      "\ud83d\ude00 DL: [DRIVERS_LICENSE]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { drivers_license: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.drivers_license)).toBe(true);
    expect(instance.policy.drivers_license).not.toBe(
      config.rules.drivers_license,
    );
  });

  test("drivers_license off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { drivers_license: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown drivers_license rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { drivers_license: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
