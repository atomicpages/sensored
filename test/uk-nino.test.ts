import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { uk_nino: { action: "redact" } },
});

describe("uk-nino complete-string processing", () => {
  test.each([
    ["AB123456C", "[UK_NINO]"],
    ["AB 12 34 56 C", "[UK_NINO]"],
    ["JH123456A", "[UK_NINO]"],
    ["CE123456D", "[UK_NINO]"],
    ["BG123456F", "[UK_NINO]"],
    ["KT123456J", "[UK_NINO]"],
    ["NP123456H", "[UK_NINO]"],
    ["RW123456M", "[UK_NINO]"],
    ["SN123456N", "[UK_NINO]"],
    ["TP123456P", "[UK_NINO]"],
    ["WL123456R", "[UK_NINO]"],
    ["YM123456S", "[UK_NINO]"],
    ["ZP123456T", "[UK_NINO]"],
    ["AC123456W", "[UK_NINO]"],
    ["EA123456X", "[UK_NINO]"],
    ["GH123456Y", "[UK_NINO]"],
    ["JK123456Z", "[UK_NINO]"],
    ["ab123456c", "[UK_NINO]"],
    ["NINO: AB123456C", "NINO: [UK_NINO]"],
    ["NINO: AB 12 34 56 C", "NINO: [UK_NINO]"],
    ["AB123456C and JH123456A", "[UK_NINO] and [UK_NINO]"],
    ["before AB123456C after", "before [UK_NINO] after"],
    ["AB123456C.", "[UK_NINO]."],
    ["(AB123456C)", "([UK_NINO])"],
    ["AB 12 34 56 C.", "[UK_NINO]."],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["DB123456C", "invalid first letter D"],
    ["FB123456C", "invalid first letter F"],
    ["IB123456C", "invalid first letter I"],
    ["QB123456C", "invalid first letter Q"],
    ["UB123456C", "invalid first letter U"],
    ["VB123456C", "invalid first letter V"],
    ["AO123456C", "invalid second letter O"],
    ["AB123456E", "invalid suffix E"],
    ["AB123456G", "invalid suffix G"],
    ["AB123456I", "invalid suffix I"],
    ["AB123456K", "invalid suffix K"],
    ["AB123456L", "invalid suffix L"],
    ["AB123456O", "invalid suffix O"],
    ["AB123456Q", "invalid suffix Q"],
    ["AB123456U", "invalid suffix U"],
    ["AB123456V", "invalid suffix V"],
    ["AB12345C", "wrong digit count - 5 digits"],
    ["AB1234567C", "wrong digit count - 7 digits"],
    ["xAB123456C", "embedded in letter before"],
    ["AB123456Cx", "embedded in letter after"],
    ["AB123456C_", "embedded in underscore after"],
    ["_AB123456C", "embedded in underscore before"],
    ["1AB123456C", "embedded in number before"],
    ["AB123456C1", "embedded in number after"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("NINO: AB123456C");
    expect(result.text).toBe("NINO: [UK_NINO]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "AB123456C",
      ruleId: "uk_nino",
      entityType: "uk_nino",
      reasons: ["uk_nino.format"],
    });
    expect(result.groups[0]?.start).toBe(6);
    expect(result.groups[0]?.end).toBe(15);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        uk_nino: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("AB123456C")).toBe("*****456C");
    expect(masker.redact("AB 12 34 56 C")).toBe("*********56 C");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { uk_nino: { action: "remove" } },
    });
    expect(remover.redact("NINO: AB123456C")).toBe("NINO: ");
    expect(remover.redact("AB123456C")).toBe("");
  });

  test("coexists with email detector", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        uk_nino: { action: "redact" },
      },
    });
    expect(both.redact("Email: alice@example.com NINO: AB123456C")).toBe(
      "Email: [EMAIL] NINO: [UK_NINO]",
    );
  });

  test("multiple NINOs in text", () => {
    expect(redactor.redact("AB123456C JH123456A CE123456D")).toBe(
      "[UK_NINO] [UK_NINO] [UK_NINO]",
    );
  });

  test("emoji before candidate does not shift alignment", () => {
    expect(redactor.redact("\ud83d\ude00 AB123456C")).toBe(
      "\ud83d\ude00 [UK_NINO]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { uk_nino: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.uk_nino)).toBe(true);
    expect(instance.policy.uk_nino).not.toBe(config.rules.uk_nino);
  });

  test("uk_nino off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { uk_nino: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown uk_nino rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { uk_nino: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
