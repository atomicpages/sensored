import { describe, expect, it } from "bun:test";
import { createRedactor } from "../src";

describe("format-preserve: basic transformations", () => {
  const redactor = createRedactor({
    rules: {
      email: { action: "format-preserve" },
      payment_card: { action: "format-preserve" },
      us_ssn: { action: "format-preserve" },
      phone: { action: "format-preserve" },
    },
  });

  it("preserves email structure", () => {
    expect(redactor.redact("Contact john@example.com")).toBe(
      "Contact ****@*******.***",
    );
  });

  it("preserves payment card structure", () => {
    expect(redactor.redact("Card 4111-1111-1111-1111")).toBe(
      "Card XXXX-XXXX-XXXX-XXXX",
    );
    expect(redactor.redact("Card 4242424242424242")).toBe(
      "Card XXXXXXXXXXXXXXXX",
    );
  });

  it("preserves SSN structure", () => {
    expect(redactor.redact("SSN 123-45-6789")).toBe("SSN XXX-XX-XXXX");
  });

  it("preserves phone structure", () => {
    expect(redactor.redact("Call +1-415-555-1234")).toBe(
      "Call +X-XXX-XXX-XXXX",
    );
  });
});

describe("format-preserve: mixed content", () => {
  const redactor = createRedactor({
    rules: {
      email: { action: "format-preserve" },
      payment_card: { action: "format-preserve" },
      us_ssn: { action: "format-preserve" },
    },
  });

  it("handles multiple entities in one string", () => {
    const result = redactor.redact(
      "email john@example.com card 4111111111111111 ssn 123-45-6789",
    );
    expect(result).toBe(
      "email ****@*******.*** card XXXXXXXXXXXXXXXX ssn XXX-XX-XXXX",
    );
  });

  it("preserves surrounding text exactly", () => {
    const result = redactor.redact(
      "Before john@example.com after SSN 123-45-6789 end",
    );
    expect(result).toBe("Before ****@*******.*** after SSN XXX-XX-XXXX end");
  });
});

describe("format-preserve: idempotency", () => {
  const redactor = createRedactor({
    rules: {
      email: { action: "format-preserve" },
      payment_card: { action: "format-preserve" },
      us_ssn: { action: "format-preserve" },
    },
  });

  it("redacting already-format-preserved text is a no-op", () => {
    const original = "email john@example.com ssn 123-45-6789";
    const once = redactor.redact(original);
    const twice = redactor.redact(once);
    expect(once).toBe("email ****@*******.*** ssn XXX-XX-XXXX");
    expect(twice).toBe(once);
  });

  it("format-preserved payment card is idempotent", () => {
    const original = "card 4111-1111-1111-1111";
    const once = redactor.redact(original);
    const twice = redactor.redact(once);
    expect(once).toBe("card XXXX-XXXX-XXXX-XXXX");
    expect(twice).toBe(once);
  });
});

describe("format-preserve: precedence", () => {
  it("remove wins over format-preserve", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "format-preserve" },
        payment_card: { action: "remove" },
      },
    });
    expect(
      redactor.redact("email john@example.com card 4111111111111111"),
    ).toBe("email ****@*******.*** card ");
  });

  it("redact wins over format-preserve", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "redact" },
        payment_card: { action: "format-preserve" },
      },
    });
    expect(
      redactor.redact("email john@example.com card 4111111111111111"),
    ).toBe("email [EMAIL] card XXXXXXXXXXXXXXXX");
  });

  it("format-preserve wins over mask", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "format-preserve" },
        payment_card: { action: "mask", preserve: { first: 4, last: 4 } },
      },
    });
    expect(
      redactor.redact("email john@example.com card 4111111111111111"),
    ).toBe("email ****@*******.*** card 4111********1111");
  });

  it("format-preserve wins over token-replace", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "format-preserve" },
        payment_card: { action: "token-replace" },
      },
    });
    expect(
      redactor.redact("email john@example.com card 4111111111111111"),
    ).toBe("email ****@*******.*** card 0000-0000-0000-0001");
  });
});

describe("format-preserve: restoration", () => {
  it("works with restore: true", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "format-preserve" },
        us_ssn: { action: "format-preserve" },
      },
      restore: true,
    });

    const original = "email john@example.com ssn 123-45-6789";
    const result = redactor.redact(original);

    expect(result.text).toBe("email [EMAIL_1] ssn [US_SSN_1]");
    expect(result.map["[EMAIL_1]"]).toBe("john@example.com");
    expect(result.map["[US_SSN_1]"]).toBe("123-45-6789");
    expect(redactor.restore(result.text, result.map)).toBe(original);
  });
});

describe("format-preserve: validation", () => {
  it("rejects unknown keys on format-preserve setting", () => {
    expect(() =>
      createRedactor({
        rules: {
          // @ts-expect-error -- testing invalid config
          email: { action: "format-preserve", replacement: "[EMAIL]" },
        },
      }),
    ).toThrow();
  });
});
