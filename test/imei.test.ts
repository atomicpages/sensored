import { describe, expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: { imei: { action: "redact" } },
});

describe("imei positive cases", () => {
  test.each([
    ["490154203237518", "[IMEI]"],
    ["356938035643809", "[IMEI]"],
    ["4901542032375180", "[IMEI]"],
    ["IMEI: 490154203237518", "IMEI: [IMEI]"],
    ["IMEI: 4901542032375180", "IMEI: [IMEI]"],
    ["Device 356938035643809 online", "Device [IMEI] online"],
    ["490154203237518 and 356938035643809", "[IMEI] and [IMEI]"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });
});

describe("imei negative cases", () => {
  test.each([
    ["49015420323751", "14 digits"],
    ["49015420323751800", "17 digits"],
    ["490154203237519", "bad Luhn 15"],
    ["4901542032375190", "bad Luhn 16 (first 15 fail)"],
    ["000000000000000", "all same digit 15"],
    ["0000000000000000", "all same digit 16"],
    ["x490154203237518", "embedded in letter before"],
    ["490154203237518x", "embedded in letter after"],
    ["490154203237518_", "embedded in underscore after"],
    ["_490154203237518", "embedded in underscore before"],
    ["", "empty string"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });
});

describe("imei boundary cases", () => {
  test("exactly 15 valid at start", () => {
    expect(redactor.redact("490154203237518 is the IMEI")).toBe(
      "[IMEI] is the IMEI",
    );
  });

  test("exactly 15 valid at end", () => {
    expect(redactor.redact("The IMEI is 490154203237518")).toBe(
      "The IMEI is [IMEI]",
    );
  });

  test("exactly 16 valid at start", () => {
    expect(redactor.redact("4901542032375180 is the IMEISV")).toBe(
      "[IMEI] is the IMEISV",
    );
  });

  test("exactly 16 valid at end", () => {
    expect(redactor.redact("The IMEISV is 4901542032375180")).toBe(
      "The IMEISV is [IMEI]",
    );
  });

  test("15-digit invalid Luhn not matched", () => {
    expect(redactor.redact("490154203237519")).toBe("490154203237519");
  });

  test("16-digit invalid Luhn not matched", () => {
    expect(redactor.redact("4901542032375190")).toBe("4901542032375190");
  });

  test("trailing period preserved", () => {
    expect(redactor.redact("IMEI 490154203237518.")).toBe("IMEI [IMEI].");
  });

  test("parenthesized IMEI", () => {
    expect(redactor.redact("(490154203237518)")).toBe("([IMEI])");
  });
});

describe("imei adversarial cases", () => {
  test("emoji adjacency before is redacted", () => {
    expect(redactor.redact("\ud83d\udc4d490154203237518")).toBe(
      "\ud83d\udc4d[IMEI]",
    );
  });

  test("emoji adjacency after is redacted", () => {
    expect(redactor.redact("490154203237518\ud83d\udc4d")).toBe(
      "[IMEI]\ud83d\udc4d",
    );
  });

  test("already-redacted text is idempotent", () => {
    const once = redactor.redact("IMEI: 490154203237518");
    const twice = redactor.redact(once);
    expect(once).toBe("IMEI: [IMEI]");
    expect(twice).toBe(once);
  });

  test("coexists with payment_card detector", () => {
    const both = createRedactor({
      rules: {
        imei: { action: "redact" },
        payment_card: { action: "redact" },
      },
    });
    expect(
      both.redact("IMEI: 4901542032375180 Card: 4242 4242 4242 4242"),
    ).toBe("IMEI: [IMEI] Card: [PAYMENT_CARD]");
  });
});

describe("imei inspection", () => {
  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("IMEI: 490154203237518");
    expect(result.text).toBe("IMEI: [IMEI]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "490154203237518",
      ruleId: "imei",
      entityType: "imei",
      reasons: ["imei.luhn", "imei.format"],
    });
    expect(result.groups[0]?.start).toBe(6);
    expect(result.groups[0]?.end).toBe(21);
  });
});

describe("imei mask action", () => {
  const masker = createRedactor({
    rules: { imei: { action: "mask", preserve: { last: 4 } } },
  });

  test("mask preserves last 4 graphemes for 15-digit", () => {
    expect(masker.redact("490154203237518")).toBe("***********7518");
  });

  test("mask preserves last 4 graphemes for 16-digit", () => {
    expect(masker.redact("4901542032375180")).toBe("************5180");
  });
});

describe("imei remove action", () => {
  const remover = createRedactor({
    rules: { imei: { action: "remove" } },
  });

  test("remove deletes 15-digit candidate", () => {
    expect(remover.redact("IMEI: 490154203237518")).toBe("IMEI: ");
  });

  test("remove deletes standalone 16-digit candidate", () => {
    expect(remover.redact("4901542032375180")).toBe("");
  });
});
