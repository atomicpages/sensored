import { describe, expect, test } from "bun:test";
import {
  createRedactor,
  employeeIdExample,
  MAX_INPUT_LENGTH,
  SensoredError,
} from "../src";

const redactor = createRedactor({
  rules: { employee_id_example: { action: "redact" } },
  detectors: [employeeIdExample],
});

describe("Employee ID example detector — positive cases", () => {
  test.each([
    ["Employee ID: AB123456", "Employee ID: [EMPLOYEE_ID]"],
    ["Employee ID:AB123456", "Employee ID:[EMPLOYEE_ID]"],
    ["Employee ID  AB123456", "Employee ID  [EMPLOYEE_ID]"],
    ["Employee ID# AB123456", "Employee ID# [EMPLOYEE_ID]"],
    ["Employee ID#AB123456", "Employee ID#[EMPLOYEE_ID]"],
    ["employee id: AB123456", "employee id: [EMPLOYEE_ID]"],
    ["EMPLOYEE ID: AB123456", "EMPLOYEE ID: [EMPLOYEE_ID]"],
    ["Employee ID:\tAB123456", "Employee ID:\t[EMPLOYEE_ID]"],
    ["Employee ID: \t AB123456", "Employee ID: \t [EMPLOYEE_ID]"],
    [
      "Employee ID: AB123456 and Employee ID: CD654321",
      "Employee ID: [EMPLOYEE_ID] and Employee ID: [EMPLOYEE_ID]",
    ],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test("redacts at start of string", () => {
    expect(redactor.redact("Employee ID: AB123456")).toBe(
      "Employee ID: [EMPLOYEE_ID]",
    );
  });

  test("redacts with surrounding text", () => {
    expect(
      redactor.redact("Please provide Employee ID: AB123456 for records."),
    ).toBe("Please provide Employee ID: [EMPLOYEE_ID] for records.");
  });
});

describe("Employee ID example detector — negative cases", () => {
  test.each([
    ["AB123456", "no label"],
    ["Give me the employees reference AB123456", "non-qualifying label"],
    ["Employee ID: AB12345", "only 5 digits"],
    ["Employee ID: ABC123456", "3 letters"],
    ["Employee ID: ab123456", "lowercase letters"],
    ["XEmployee ID: AB123456", "label embedded in word"],
    ["Employee ID: AB1234567", "7 digits"],
    ["Employee ID: xAB123456", "candidate preceded by word char"],
    ["Employee ID: AB123456x", "candidate followed by word char"],
    ["Employee ID: AB123456_", "candidate followed by underscore"],
    ["_Employee ID: AB123456", "label preceded by underscore"],
    ["myEmployee ID: AB123456", "label not whole — my prefix"],
    ["Employee IDX: AB123456", "label not whole — X suffix"],
    ["Employee ID:\nAB123456", "newline between label and candidate"],
    ["Employee ID:         AB123456", "9 spaces exceeds 0-8"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });
});

describe("Employee ID example detector — boundary cases", () => {
  test("trailing period is preserved", () => {
    expect(redactor.redact("Employee ID: AB123456.")).toBe(
      "Employee ID: [EMPLOYEE_ID].",
    );
  });

  test("trailing text is preserved", () => {
    expect(redactor.redact("Employee ID: AB123456 extra")).toBe(
      "Employee ID: [EMPLOYEE_ID] extra",
    );
  });

  test("multiple employee IDs in one text", () => {
    expect(
      redactor.redact(
        "Employee ID: AB123456 and Employee ID: CD654321 and Employee ID: EF999999",
      ),
    ).toBe(
      "Employee ID: [EMPLOYEE_ID] and Employee ID: [EMPLOYEE_ID] and Employee ID: [EMPLOYEE_ID]",
    );
  });

  test("coexists with email detector", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        employee_id_example: { action: "redact" },
      },
      detectors: [employeeIdExample],
    });
    expect(both.redact("Email: alice@example.com Employee ID: AB123456")).toBe(
      "Email: [EMAIL] Employee ID: [EMPLOYEE_ID]",
    );
  });

  test("coexists with SSN detector", () => {
    const both = createRedactor({
      rules: {
        us_ssn: { action: "redact" },
        employee_id_example: { action: "redact" },
      },
      detectors: [employeeIdExample],
    });
    expect(both.redact("SSN: 123-45-6789 Employee ID: AB123456")).toBe(
      "SSN: [US_SSN] Employee ID: [EMPLOYEE_ID]",
    );
  });

  test("coexists with payment-card detector", () => {
    const both = createRedactor({
      rules: {
        payment_card: { action: "redact" },
        employee_id_example: { action: "redact" },
      },
      detectors: [employeeIdExample],
    });
    expect(both.redact("Card: 4242424242424242 Employee ID: AB123456")).toBe(
      "Card: [PAYMENT_CARD] Employee ID: [EMPLOYEE_ID]",
    );
  });
});

describe("Employee ID example detector — actions", () => {
  test("mask preserves first 2 graphemes", () => {
    const masker = createRedactor({
      rules: {
        employee_id_example: { action: "mask", preserve: { first: 2 } },
      },
      detectors: [employeeIdExample],
    });
    expect(masker.redact("Employee ID: AB123456")).toBe(
      "Employee ID: AB******",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { employee_id_example: { action: "remove" } },
      detectors: [employeeIdExample],
    });
    expect(remover.redact("Employee ID: AB123456")).toBe("Employee ID: ");
  });

  test("custom replacement", () => {
    const custom = createRedactor({
      rules: {
        employee_id_example: { action: "redact", replacement: "[CUSTOM]" },
      },
      detectors: [employeeIdExample],
    });
    expect(custom.redact("Employee ID: AB123456")).toBe(
      "Employee ID: [CUSTOM]",
    );
  });
});

describe("Employee ID example detector — inspection", () => {
  test("inspect returns correct spans, ruleId, entityType, reasons, value", () => {
    const result = redactor.inspect("Employee ID: AB123456");
    expect(result.text).toBe("Employee ID: [EMPLOYEE_ID]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "AB123456",
      ruleId: "employee_id_example",
      entityType: "employee_id",
      reasons: ["employee_id_example.context"],
    });
    expect(result.groups[0]?.start).toBe(13);
    expect(result.groups[0]?.end).toBe(21);
  });

  test("inspect for multiple matches", () => {
    const result = redactor.inspect(
      "Employee ID: AB123456 and Employee ID: CD654321",
    );
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]?.matches[0]?.value).toBe("AB123456");
    expect(result.groups[1]?.matches[0]?.value).toBe("CD654321");
  });

  test("policy is frozen", () => {
    const config = {
      rules: {
        employee_id_example: { action: "redact" as const },
      },
      detectors: [employeeIdExample],
    };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.employee_id_example)).toBe(true);
    expect(instance.policy.employee_id_example).not.toBe(
      config.rules.employee_id_example,
    );
  });
});

describe("Employee ID example detector — error safety", () => {
  test("invalid input type throws SensoredError", () => {
    expect(() => redactor.redact(123 as never)).toThrow(SensoredError);
    expect(() => redactor.redact(null as never)).toThrow(SensoredError);
    expect(() => redactor.redact(undefined as never)).toThrow(SensoredError);
  });

  test("input over limit throws SensoredError", () => {
    const limited = createRedactor({
      rules: { employee_id_example: { action: "redact" } },
      detectors: [employeeIdExample],
      limits: { maxInputLength: 10 },
    });
    expect(() => limited.redact("x".repeat(11))).toThrow(SensoredError);
  });

  test("input at exact limit is accepted", () => {
    const limited = createRedactor({
      rules: { employee_id_example: { action: "redact" } },
      detectors: [employeeIdExample],
      limits: { maxInputLength: MAX_INPUT_LENGTH },
    });
    expect(limited.redact("x".repeat(MAX_INPUT_LENGTH)).length).toBe(
      MAX_INPUT_LENGTH,
    );
  });
});
