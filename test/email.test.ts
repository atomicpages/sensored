import { describe, expect, test } from "bun:test";
import { createRedactor, MAX_INPUT_LENGTH, SensoredError } from "../src";

const redactor = createRedactor({ rules: { email: { action: "redact" } } });

describe("email complete-string processing", () => {
  test.each([
    ["Email: alice+ops@example.com.", "Email: [EMAIL]."],
    ["a@b.co and z@host.example.au!", "[EMAIL] and [EMAIL]!"],
    ["<alice@example.com>", "<[EMAIL]>"],
    ["a..b@example.com", "a..b@example.com"],
    ["alice@example", "alice@example"],
    ["éAlice@example.com", "éAlice@example.com"],
    ["𝒂Alice@example.com", "𝒂Alice@example.com"],
    ["a@example.com𝟙", "a@example.com𝟙"],
    ['"alice"@example.com', '"alice"@example.com'],
    [
      '"hello alice@example.com"@example.net',
      '"hello alice@example.com"@example.net',
    ],
    ['"alice@example.com"', '"alice@example.com"'],
    ["a@example.com_", "a@example.com_"],
    ["a@example.com@x", "a@example.com@x"],
    ["a@example.com..", "a@example.com.."],
    ["a@example.com\u200d", "a@example.com\u200d"],
    ["a@example.com\u0301", "a@example.com\u0301"],
    [`${"a".repeat(65)}@example.com`, `${"a".repeat(65)}@example.com`],
    [`a@${"b".repeat(64)}.com`, `a@${"b".repeat(64)}.com`],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("😀 alice@example.com and bob@example.com");
    expect(result.text).toBe("😀 [EMAIL] and [EMAIL]");
    expect(result.groups.map(({ start, end }) => [start, end])).toEqual([
      [3, 20],
      [25, 40],
    ]);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "alice@example.com",
      ruleId: "email",
      reasons: ["email.ascii_dot_atom", "email.dns_domain"],
    });
  });

  test("policy is a frozen snapshot", () => {
    const config = { rules: { email: { action: "redact" as const } } };
    const instance = createRedactor(config);
    expect(Object.isFrozen(instance.policy.email)).toBe(true);
    expect(instance.policy.email).not.toBe(config.rules.email);
  });

  test("requires explicit nonempty settings and safe errors", () => {
    expect(() => createRedactor({ rules: {} })).toThrow(SensoredError);
    expect(() => createRedactor({ rules: { email: "off" } })).toThrow(
      SensoredError,
    );
    try {
      createRedactor({
        rules: { "private@example.com": { action: "redact" } },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect(JSON.stringify(error)).not.toContain("private@example.com");
      expect(error).toMatchObject({ code: "UNKNOWN_RULE", path: "rules" });
    }
  });

  test("input limit is UTF-16 based and inclusive", () => {
    expect(redactor.redact("x".repeat(MAX_INPUT_LENGTH)).length).toBe(
      MAX_INPUT_LENGTH,
    );
    expect(() => redactor.redact("x".repeat(MAX_INPUT_LENGTH + 1))).toThrow(
      SensoredError,
    );
  });
});

test("configurable input limit validates and snapshots", () => {
  const config = {
    rules: { email: { action: "redact" as const } },
    limits: { maxInputLength: 3 },
  };
  const instance = createRedactor(config);
  config.limits.maxInputLength = 100;
  expect(instance.redact("abc")).toBe("abc");
  expect(() => instance.redact("abcd")).toThrow(SensoredError);
  for (const maxInputLength of [
    0,
    -1,
    1.5,
    Infinity,
    NaN,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    expect(() =>
      createRedactor({ ...config, limits: { maxInputLength } }),
    ).toThrow(SensoredError);
  }
});
