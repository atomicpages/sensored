import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { pl_pesel: { action: "redact" } },
});

describe("pl-pesel complete-string processing", () => {
  test.each([
    ["PESEL: 44051401458", "PESEL: [PL_PESEL]"],
    ["PESEL: 10000061725", "PESEL: [PL_PESEL]"],
    ["Polish ID: 44051401458", "Polish ID: [PL_PESEL]"],
    ["National ID: 10000061725", "National ID: [PL_PESEL]"],
    ["Identity Number: 44051401458", "Identity Number: [PL_PESEL]"],
    [
      "PESEL 44051401458 and PESEL 10000061725",
      "PESEL [PL_PESEL] and PESEL [PL_PESEL]",
    ],
    ["PESEL: 44051401458.", "PESEL: [PL_PESEL]."],
    ["(PESEL: 44051401458)", "(PESEL: [PL_PESEL])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["44051401458", "no context"],
    ["44051401459", "invalid checksum"],
    ["4405140145", "10 digits (too short)"],
    ["440514014588", "12 digits (too long)"],
    ["44051401458extra", "embedded in letter after"],
    ["extra44051401458", "embedded in letter before"],
    ["44051401458_", "embedded in underscore after"],
    ["_44051401458", "embedded in underscore before"],
    ["44051401458\u0301", "embedded in combining mark after"],
    ["my44051401458file", "embedded in word"],
    ["PESEL: 44051401459", "invalid checksum with context"],
    ["PESEL: 4405140145", "too short with context"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("trailing period is preserved", () => {
    expect(redactor.redact("PESEL: 44051401458.")).toBe("PESEL: [PL_PESEL].");
  });

  test("leading punctuation is preserved", () => {
    expect(redactor.redact("PESEL: 44051401458]")).toBe("PESEL: [PL_PESEL]]");
  });

  test("multiple PESELs", () => {
    expect(redactor.redact("PESEL 44051401458 and PESEL 10000061725")).toBe(
      "PESEL [PL_PESEL] and PESEL [PL_PESEL]",
    );
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("PESEL: 44051401458");
    expect(result.text).toBe("PESEL: [PL_PESEL]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "44051401458",
      ruleId: "pl_pesel",
      entityType: "pl_pesel",
      reasons: ["pl_pesel.checksum", "pl_pesel.context"],
    });
    expect(result.groups[0]?.start).toBe(7);
    expect(result.groups[0]?.end).toBe(18);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        pl_pesel: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("PESEL: 44051401458")).toBe("PESEL: *******1458");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { pl_pesel: { action: "remove" } },
    });
    expect(remover.redact("PESEL: 44051401458")).toBe("PESEL: ");
  });

  test("coexists with payment_card detector", () => {
    const both = createRedactor({
      rules: {
        pl_pesel: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(both.redact("PESEL 44051401458 Card 4242424242424242")).toBe(
      "PESEL [PL_PESEL] Card [PAYMENT_CARD]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { pl_pesel: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.pl_pesel)).toBe(true);
    expect(instance.policy.pl_pesel).not.toBe(config.rules.pl_pesel);
  });

  test("pl_pesel off with no other rules throws", () => {
    expect(() =>
      createRedactor({
        rules: { pl_pesel: "off" },
      }),
    ).toThrow(SensoredError);
  });

  test("long digit sequence does not match", () => {
    expect(redactor.redact("PESEL: 44051401458812345678901")).toBe(
      "PESEL: 44051401458812345678901",
    );
  });
});
