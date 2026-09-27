import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";
import { emailDetector } from "../src/detectors/contact/email";
import { personNameLiteDetector } from "../src/detectors/person/person-name-lite";

const redactor = createRedactor({
  rules: { person_name_lite: { action: "redact" } },
});

describe("person-name-lite complete-string processing", () => {
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
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["The weather is nice", "no names"],
    ["Hope is important", "common word not a name"],
    ["Mark the checkbox", "common word not a name"],
    ["Pat the dog", "common word not a name"],
    ["Joy is an emotion", "common word not a name"],
    ["The patient visited yesterday", "no names"],
    ["Please check the box", "no names"],
    ["The Quick Brown Fox", "title-case common words"],
    ["How are you", "sentence-start common word"],
    [
      "Margot's PCOS is progressively worse",
      "single-word name without honorific",
    ],
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
      ruleId: "person_name_lite",
      entityType: "person_name_lite",
      reasons: ["person_name_lite.bloom"],
    });
    expect(result.groups[0]?.start).toBe(6);
    expect(result.groups[0]?.end).toBe(16);
  });

  test("mask preserves first and last graphemes", () => {
    const masker = createRedactor({
      rules: {
        person_name_lite: { action: "mask", preserve: { first: 1, last: 1 } },
      },
    });
    expect(masker.redact("John Smith is here")).toBe("J********h is here");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { person_name_lite: { action: "remove" } },
    });
    expect(remover.redact("Name: John Smith")).toBe("Name: ");
    expect(remover.redact("John Smith")).toBe("");
  });

  test("coexists with email detector", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        person_name_lite: { action: "redact" },
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
      rules: { person_name_lite: { action: "redact" as const } },
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.person_name_lite)).toBe(true);
    expect(instance.policy.person_name_lite).not.toBe(
      config.rules.person_name_lite,
    );
  });

  test("person_name_lite off with no other rules throws", () => {
    expect(() =>
      createRedactor({ rules: { person_name_lite: "off" } }),
    ).toThrow(SensoredError);
  });

  test("unknown person_name_lite rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { person_name_lite: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });
});

describe("person-name-lite semanticConfirm", () => {
  test("returns structured Noul question", () => {
    const result = personNameLiteDetector.semanticConfirm?.({
      value: "John Smith",
      before: "Contact ",
      after: " today",
    });

    expect(result).toBeDefined();
    expect(result!.instructions).toEqual({
      task: "Determine whether the candidate text refers to a specific individual person.",
      candidate: "John Smith",
      before: "Contact ",
      after: " today",
    });
    expect(result!.criteria).toEqual({
      true: "The candidate is the name of a specific individual person (e.g. 'John Smith', 'Dr. Jane Doe').",
      false:
        "The candidate is a place, organization, product, title, or sentence-start word (e.g. 'New York', 'Apple Inc').",
    });
  });

  test("returns undefined when detector has no semanticConfirm", () => {
    const result = emailDetector.semanticConfirm?.({
      value: "alice@example.com",
      before: "Email: ",
      after: "",
    });

    expect(result).toBeUndefined();
  });
});
