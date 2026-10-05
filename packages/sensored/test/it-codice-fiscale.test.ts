import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { it_codice_fiscale: { action: "redact" } },
});

describe("it-codice-fiscale complete-string processing", () => {
  test.each([
    ["Codice Fiscale: RSSMRA85M01H501O", "Codice Fiscale: [IT_CODICE_FISCALE]"],
    ["Fiscal Code: BNCMRC80A01F205F", "Fiscal Code: [IT_CODICE_FISCALE]"],
    ["Tax Code: RSSMRA85M01H501O", "Tax Code: [IT_CODICE_FISCALE]"],
    ["Italian ID: RSSMRA85M01H501O", "Italian ID: [IT_CODICE_FISCALE]"],
    ["Codice Fiscale RSSMRA85M01H501O", "Codice Fiscale [IT_CODICE_FISCALE]"],
    [
      "Codice Fiscale RSSMRA85M01H501O and Codice Fiscale BNCMRC80A01F205F",
      "Codice Fiscale [IT_CODICE_FISCALE] and Codice Fiscale [IT_CODICE_FISCALE]",
    ],
    [
      "Codice Fiscale: RSSMRA85M01H501O.",
      "Codice Fiscale: [IT_CODICE_FISCALE].",
    ],
    [
      "(Codice Fiscale: RSSMRA85M01H501O)",
      "(Codice Fiscale: [IT_CODICE_FISCALE])",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["RSSMRA85M01H501O", "no context"],
    ["RSSMRA85M01H501Z", "invalid control char"],
    ["RSSMRA85M01H501", "15 chars (too short)"],
    ["RSSMRA85M01H501OO", "17 chars (too long)"],
    ["RSSMRA85M01H501Oextra", "embedded in letter after"],
    ["extraRSSMRA85M01H501O", "embedded in letter before"],
    ["RSSMRA85M01H501O_", "embedded in underscore after"],
    ["_RSSMRA85M01H501O", "embedded in underscore before"],
    ["myRSSMRA85M01H501Ofile", "embedded in word"],
    ["Codice Fiscale: RSSMRA85M01H501Z", "invalid control char with context"],
    ["Codice Fiscale: RSSMRA85M01H50", "too short with context"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("trailing period is preserved", () => {
    expect(redactor.redact("Codice Fiscale: RSSMRA85M01H501O.")).toBe(
      "Codice Fiscale: [IT_CODICE_FISCALE].",
    );
  });

  test("leading punctuation is preserved", () => {
    expect(redactor.redact("Codice Fiscale: RSSMRA85M01H501O]")).toBe(
      "Codice Fiscale: [IT_CODICE_FISCALE]]",
    );
  });

  test("multiple Codice Fiscale with mixed formats", () => {
    expect(
      redactor.redact(
        "Codice Fiscale RSSMRA85M01H501O and Codice Fiscale BNCMRC80A01F205F",
      ),
    ).toBe(
      "Codice Fiscale [IT_CODICE_FISCALE] and Codice Fiscale [IT_CODICE_FISCALE]",
    );
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Codice Fiscale: RSSMRA85M01H501O");
    expect(result.text).toBe("Codice Fiscale: [IT_CODICE_FISCALE]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "RSSMRA85M01H501O",
      ruleId: "it_codice_fiscale",
      entityType: "it_codice_fiscale",
      reasons: ["it_codice_fiscale.checksum", "it_codice_fiscale.context"],
    });
    expect(result.groups[0]?.start).toBe(16);
    expect(result.groups[0]?.end).toBe(32);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = createRedactor({
      rules: {
        it_codice_fiscale: { action: "mask", preserve: { last: 4 } },
      },
    });
    expect(masker.redact("Codice Fiscale: RSSMRA85M01H501O")).toBe(
      "Codice Fiscale: ************501O",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { it_codice_fiscale: { action: "remove" } },
    });
    expect(remover.redact("Codice Fiscale: RSSMRA85M01H501O")).toBe(
      "Codice Fiscale: ",
    );
  });

  test("coexists with payment_card detector", () => {
    const both = createRedactor({
      rules: {
        it_codice_fiscale: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(
      both.redact("Codice Fiscale RSSMRA85M01H501O Card 4242424242424242"),
    ).toBe("Codice Fiscale [IT_CODICE_FISCALE] Card [PAYMENT_CARD]");
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { it_codice_fiscale: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.it_codice_fiscale)).toBe(true);
    expect(instance.policy.it_codice_fiscale).not.toBe(
      config.rules.it_codice_fiscale,
    );
  });

  test("it_codice_fiscale off with no other rules throws", () => {
    expect(() =>
      createRedactor({
        rules: { it_codice_fiscale: "off" },
      }),
    ).toThrow(SensoredError);
  });

  test("lowercase codice fiscale is detected", () => {
    expect(redactor.redact("Codice Fiscale: rssmra85m01h501o")).toBe(
      "Codice Fiscale: [IT_CODICE_FISCALE]",
    );
  });
});
