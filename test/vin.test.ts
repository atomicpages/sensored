import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { vin: { action: "redact" } },
});

describe("vin complete-string processing", () => {
  test.each([
    ["1HGCM82673A123456", "[VIN]"],
    ["WP0ZZZ996TS402083", "[VIN]"],
    ["2T1BURHE3JC012345", "[VIN]"],
    ["1FTFW1ET9DFA12345", "[VIN]"],
    ["JM1NC25F970123456", "[VIN]"],
    ["WBA3D9C57AF123450", "[VIN]"],
    ["VIN: 1HGCM82673A123456", "VIN: [VIN]"],
    ["before 1HGCM82673A123456 after", "before [VIN] after"],
    ["1HGCM82673A123456.", "[VIN]."],
    ["(1HGCM82673A123456)", "([VIN])"],
    ["1HGCM82673A123456 and WP0ZZZ996TS402083", "[VIN] and [VIN]"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["1HGCM82633A123456", "invalid checksum"],
    ["1HGCM82673A12345", "16 chars"],
    ["1HGCM82673A1234566", "18 chars"],
    ["1HGCM82673A12345I", "contains I"],
    ["1HGCM82673A12345O", "contains O"],
    ["1HGCM82673A12345Q", "contains Q"],
    ["ABCDEFGHJKLMNPQRSTUVWXYZ", "all alpha no digits"],
    ["11111111111111111", "all same char"],
    ["x1HGCM82673A123456", "embedded in word before"],
    ["1HGCM82673A123456x", "embedded in word after"],
    ["x1HGCM82673A123456x", "embedded in word both sides"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("exactly 17 chars valid", () => {
    expect(redactor.redact("1HGCM82673A123456")).toBe("[VIN]");
  });

  test("exactly 17 chars invalid checksum", () => {
    expect(redactor.redact("1HGCM82633A123456")).toBe("1HGCM82633A123456");
  });

  test("VIN at start of string", () => {
    expect(redactor.redact("1HGCM82673A123456 is the VIN")).toBe(
      "[VIN] is the VIN",
    );
  });

  test("VIN at end of string", () => {
    expect(redactor.redact("The VIN is 1HGCM82673A123456")).toBe(
      "The VIN is [VIN]",
    );
  });

  test("multiple VINs", () => {
    expect(redactor.redact("1HGCM82673A123456 WP0ZZZ996TS402083")).toBe(
      "[VIN] [VIN]",
    );
  });

  test("emoji adjacency before is redacted", () => {
    expect(redactor.redact("\ud83d\ude971HGCM82673A123456")).toBe(
      "\ud83d\ude97[VIN]",
    );
  });

  test("emoji adjacency after is redacted", () => {
    expect(redactor.redact("1HGCM82673A123456\ud83d\ude97")).toBe(
      "[VIN]\ud83d\ude97",
    );
  });

  test("already-redacted text", () => {
    expect(redactor.redact("VIN: [VIN]")).toBe("VIN: [VIN]");
  });

  test("empty string", () => {
    expect(redactor.redact("")).toBe("");
  });

  test("no alphanumeric", () => {
    expect(redactor.redact("--- !!! ---")).toBe("--- !!! ---");
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("VIN: 1HGCM82673A123456");
    expect(result.text).toBe("VIN: [VIN]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "1HGCM82673A123456",
      ruleId: "vin",
      entityType: "vin",
      reasons: ["vin.checksum", "vin.format"],
    });
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(22);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        vin: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("1HGCM82673A123456")).toBe("*************3456");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { vin: { action: "remove" } },
    });
    expect(remover.redact("VIN: 1HGCM82673A123456")).toBe("VIN: ");
    expect(remover.redact("1HGCM82673A123456")).toBe("");
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { vin: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.vin)).toBe(true);
    expect(instance.policy.vin).not.toBe(config.rules.vin);
  });

  test("vin off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { vin: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown vin rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { vin: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
