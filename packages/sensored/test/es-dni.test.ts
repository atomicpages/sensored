import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { es_dni: { action: "redact" } },
});

describe("es-dni complete-string processing", () => {
  test.each([
    ["DNI: 12345678Z", "DNI: [ES_DNI]"],
    ["DNI: 00000001R", "DNI: [ES_DNI]"],
    ["DNI: 23456789D", "DNI: [ES_DNI]"],
    ["DNI: 87654321X", "DNI: [ES_DNI]"],
    [
      "Documento Nacional de Identidad: 12345678Z",
      "Documento Nacional de Identidad: [ES_DNI]",
    ],
    ["Spanish ID: 23456789D", "Spanish ID: [ES_DNI]"],
    ["National ID: 87654321X", "National ID: [ES_DNI]"],
    ["DNI 12345678Z and DNI 23456789D", "DNI [ES_DNI] and DNI [ES_DNI]"],
    ["DNI: 12345678Z.", "DNI: [ES_DNI]."],
    ["(DNI: 12345678Z)", "(DNI: [ES_DNI])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["12345678Z", "no context"],
    ["12345678A", "invalid checksum (wrong letter)"],
    ["1234567Z", "7 digits + letter (too short)"],
    ["123456789Z", "9 digits + letter (too long)"],
    ["12345678Zextra", "embedded in letter after"],
    ["extra12345678Z", "embedded in letter before"],
    ["12345678Z_", "embedded in underscore after"],
    ["_12345678Z", "embedded in underscore before"],
    ["12345678Z\u0301", "embedded in combining mark after"],
    ["my12345678Zfile", "embedded in word"],
    ["DNI: 12345678A", "invalid checksum with context"],
    ["DNI: 1234567Z", "too short with context"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("trailing period is preserved", () => {
    expect(redactor.redact("DNI: 12345678Z.")).toBe("DNI: [ES_DNI].");
  });

  test("leading punctuation is preserved", () => {
    expect(redactor.redact("DNI: 12345678Z]")).toBe("DNI: [ES_DNI]]");
  });

  test("multiple DNIs with mixed formats", () => {
    expect(redactor.redact("DNI 12345678Z and DNI 23456789D")).toBe(
      "DNI [ES_DNI] and DNI [ES_DNI]",
    );
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("DNI: 12345678Z");
    expect(result.text).toBe("DNI: [ES_DNI]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "12345678Z",
      ruleId: "es_dni",
      entityType: "es_dni",
      reasons: ["es_dni.checksum", "es_dni.context"],
    });
    expect(result.groups[0]?.start).toBe(5);
    expect(result.groups[0]?.end).toBe(14);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        es_dni: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("DNI: 12345678Z")).toBe("DNI: *****678Z");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { es_dni: { action: "remove" } },
    });
    expect(remover.redact("DNI: 12345678Z")).toBe("DNI: ");
  });

  test("coexists with payment_card detector", () => {
    const both = createRedactor({
      rules: {
        es_dni: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(both.redact("DNI 12345678Z Card 4242424242424242")).toBe(
      "DNI [ES_DNI] Card [PAYMENT_CARD]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { es_dni: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.es_dni)).toBe(true);
    expect(instance.policy.es_dni).not.toBe(config.rules.es_dni);
  });

  test("es_dni off with no other rules throws", () => {
    expect(() =>
      createRedactor({
        rules: { es_dni: "off" },
      }),
    ).toThrow(SensoredError);
  });

  test("lowercase DNI letter is detected", () => {
    expect(redactor.redact("DNI: 12345678z")).toBe("DNI: [ES_DNI]");
  });
});
