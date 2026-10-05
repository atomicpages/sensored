import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { fr_insee: { action: "redact" } },
});

describe("fr-insee complete-string processing", () => {
  test.each([
    ["INSEE: 169027511610809", "INSEE: [FR_INSEE]"],
    ["NIR: 1690275116108 09", "NIR: [FR_INSEE]"],
    [
      "Numéro de Sécurité Sociale: 285123456789296",
      "Numéro de Sécurité Sociale: [FR_INSEE]",
    ],
    [
      "Social Security Number: 2851234567892 96",
      "Social Security Number: [FR_INSEE]",
    ],
    ["Numéro INSEE: 169027511610809", "Numéro INSEE: [FR_INSEE]"],
    [
      "INSEE 169027511610809 and INSEE 285123456789296",
      "INSEE [FR_INSEE] and INSEE [FR_INSEE]",
    ],
    ["INSEE: 169027511610809.", "INSEE: [FR_INSEE]."],
    ["(INSEE: 169027511610809)", "(INSEE: [FR_INSEE])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["169027511610809", "no context"],
    ["1690275116108 09", "no context (with space)"],
    ["1690275116108", "13 digits only (too short)"],
    ["1690275116108099", "16 digits (too long)"],
    ["169027511610808", "invalid control key"],
    ["1690275116108 08", "invalid control key (with space)"],
    ["169027511610809extra", "embedded in letter after"],
    ["extra169027511610809", "embedded in letter before"],
    ["169027511610809_", "embedded in underscore after"],
    ["_169027511610809", "embedded in underscore before"],
    ["my169027511610809file", "embedded in word"],
    ["INSEE: 1690275116108", "too short with context"],
    ["INSEE: 1690275116108099", "too long with context"],
    ["INSEE: 169027511610808", "invalid control key with context"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("trailing period is preserved", () => {
    expect(redactor.redact("INSEE: 169027511610809.")).toBe(
      "INSEE: [FR_INSEE].",
    );
  });

  test("leading punctuation is preserved", () => {
    expect(redactor.redact("INSEE: 169027511610809]")).toBe(
      "INSEE: [FR_INSEE]]",
    );
  });

  test("multiple INSEE numbers with mixed formats", () => {
    expect(
      redactor.redact("INSEE 169027511610809 and INSEE 2851234567892 96"),
    ).toBe("INSEE [FR_INSEE] and INSEE [FR_INSEE]");
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("INSEE: 169027511610809");
    expect(result.text).toBe("INSEE: [FR_INSEE]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "169027511610809",
      ruleId: "fr_insee",
      entityType: "fr_insee",
      reasons: ["fr_insee.checksum", "fr_insee.context"],
    });
    expect(result.groups[0]?.start).toBe(7);
    expect(result.groups[0]?.end).toBe(22);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        fr_insee: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("INSEE: 169027511610809")).toBe(
      "INSEE: ***********0809",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { fr_insee: { action: "remove" } },
    });
    expect(remover.redact("INSEE: 169027511610809")).toBe("INSEE: ");
  });

  test("coexists with payment_card detector", () => {
    const both = createRedactor({
      rules: {
        fr_insee: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(both.redact("INSEE 169027511610809 Card 4242424242424242")).toBe(
      "INSEE [FR_INSEE] Card [PAYMENT_CARD]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { fr_insee: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.fr_insee)).toBe(true);
    expect(instance.policy.fr_insee).not.toBe(config.rules.fr_insee);
  });

  test("fr_insee off with no other rules throws", () => {
    expect(() =>
      createRedactor({
        rules: { fr_insee: "off" },
      }),
    ).toThrow(SensoredError);
  });

  test("long digit sequence does not match", () => {
    expect(redactor.redact("INSEE: 1690275116108099123456789")).toBe(
      "INSEE: 1690275116108099123456789",
    );
  });

  test("spaced format with context", () => {
    expect(redactor.redact("NIR: 1690275116108 09")).toBe("NIR: [FR_INSEE]");
  });
});
