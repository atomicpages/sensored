import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { person_name: { action: "redact" } },
});

describe("person-name complete-string processing", () => {
  test.each([
    ["Name: John Smith", "Name: [PERSON_NAME]"],
    ["Dr. Jane Doe is here", "[PERSON_NAME] is here"],
    ["John Smith and Jane Doe", "[PERSON_NAME] and [PERSON_NAME]"],
    ["Patient: Mary Johnson visited", "Patient: [PERSON_NAME] visited"],
    ["Robert Downey Jr. is an actor", "[PERSON_NAME] is an actor"],
    ["Martin Luther King Jr. gave a speech", "[PERSON_NAME] gave a speech"],
    ["Mr. James Jones is here", "[PERSON_NAME] is here"],
    ["Ms. Jones is here", "[PERSON_NAME] is here"],
    ["before John Smith after", "before [PERSON_NAME] after"],
    ["John Smith.", "[PERSON_NAME]."],
    ["(John Smith)", "([PERSON_NAME])"],
    [
      "Margot's PCOS is progressively worse",
      "[PERSON_NAME]'s PCOS is progressively worse",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["The weather is nice", "no names"],
    ["Hope is important", "common word not a name"],
    ["Mark the checkbox", "common word not a name"],
    ["The patient visited yesterday", "no names"],
    ["Please check the box", "no names"],
    ["The Quick Brown Fox", "title-case common words"],
    ["How are you", "sentence-start common word"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Name: John Smith");
    expect(result.text).toBe("Name: [PERSON_NAME]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "John Smith",
      ruleId: "person_name",
      entityType: "person_name",
      reasons: ["person_name.ner"],
    });
  });

  test("mask preserves first and last graphemes", () => {
    const masker = createRedactor({
      rules: {
        person_name: { action: "mask", preserve: { first: 1, last: 1 } },
      },
    });
    expect(masker.redact("John Smith is here")).toBe("J********h is here");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { person_name: { action: "remove" } },
    });
    expect(remover.redact("Name: John Smith")).toBe("Name: ");
    expect(remover.redact("John Smith")).toBe("");
  });

  test("coexists with email detector", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        person_name: { action: "redact" },
      },
    });
    expect(both.redact("Email: alice@example.com Name: John Smith")).toBe(
      "Email: [EMAIL] Name: [PERSON_NAME]",
    );
  });

  test("multiple names in text", () => {
    expect(redactor.redact("John Smith and Jane Doe")).toBe(
      "[PERSON_NAME] and [PERSON_NAME]",
    );
  });

  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { person_name: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.person_name)).toBe(true);
    expect(instance.policy.person_name).not.toBe(config.rules.person_name);
  });

  test("person_name off with no other rules throws", () => {
    expect(() => createRedactor({ rules: { person_name: "off" } })).toThrow(
      SensoredError,
    );
  });

  test("unknown person_name rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});
