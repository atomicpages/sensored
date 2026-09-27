import { describe, expect, it } from "bun:test";
import { createRedactor } from "../src";

describe("token-replace: basic transformations", () => {
  const redactor = createRedactor({
    rules: {
      email: { action: "token-replace" },
      payment_card: { action: "token-replace" },
      us_ssn: { action: "token-replace" },
      phone: { action: "token-replace" },
    },
  });

  it("replaces email with fake value", () => {
    expect(redactor.redact("Contact john@example.com")).toBe(
      "Contact redacted@example",
    );
  });

  it("replaces payment card with fake value", () => {
    expect(redactor.redact("Card 4111111111111111")).toBe(
      "Card 0000-0000-0000-0001",
    );
  });

  it("replaces SSN with fake value", () => {
    expect(redactor.redact("SSN 123-45-6789")).toBe("SSN 000-00-0001");
  });

  it("replaces phone with fake value", () => {
    expect(redactor.redact("Call +1-415-555-1234")).toBe("Call +0-000-0000");
  });
});

describe("token-replace: determinism", () => {
  it("same input produces same output across instances", () => {
    const config = {
      rules: {
        email: { action: "token-replace" as const },
        us_ssn: { action: "token-replace" as const },
      },
    };

    const r1 = createRedactor(config);
    const r2 = createRedactor(config);

    const original = "email john@example.com ssn 123-45-6789";
    expect(r1.redact(original)).toBe(r2.redact(original));
  });

  it("same input produces same output across calls", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "token-replace" },
      },
    });

    const original = "email john@example.com";
    const once = redactor.redact(original);
    const twice = redactor.redact(original);
    expect(once).toBe(twice);
  });
});

describe("token-replace: idempotency", () => {
  const redactor = createRedactor({
    rules: {
      email: { action: "token-replace" },
      payment_card: { action: "token-replace" },
      us_ssn: { action: "token-replace" },
    },
  });

  it("redacting already-token-replaced text is a no-op", () => {
    const original = "email john@example.com ssn 123-45-6789";
    const once = redactor.redact(original);
    const twice = redactor.redact(once);
    expect(once).toBe("email redacted@example ssn 000-00-0001");
    expect(twice).toBe(once);
  });

  it("token-replaced payment card is idempotent", () => {
    const original = "card 4111111111111111";
    const once = redactor.redact(original);
    const twice = redactor.redact(once);
    expect(once).toBe("card 0000-0000-0000-0001");
    expect(twice).toBe(once);
  });
});

describe("token-replace: custom tokens", () => {
  it("uses custom token mapping", () => {
    const redactor = createRedactor({
      rules: {
        email: {
          action: "token-replace",
          tokens: { email: "[REDACTED_EMAIL]" },
        },
      },
    });

    expect(redactor.redact("Contact john@example.com")).toBe(
      "Contact [REDACTED_EMAIL]",
    );
  });

  it("uses custom token for one entity and default for another", () => {
    const redactor = createRedactor({
      rules: {
        email: {
          action: "token-replace",
          tokens: { email: "fake@nowhere" },
        },
        us_ssn: { action: "token-replace" },
      },
    });

    expect(redactor.redact("email john@example.com ssn 123-45-6789")).toBe(
      "email fake@nowhere ssn 000-00-0001",
    );
  });
});

describe("token-replace: precedence", () => {
  it("remove wins over token-replace", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "token-replace" },
        payment_card: { action: "remove" },
      },
    });
    expect(
      redactor.redact("email john@example.com card 4111111111111111"),
    ).toBe("email redacted@example card ");
  });

  it("redact wins over token-replace", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "redact" },
        payment_card: { action: "token-replace" },
      },
    });
    expect(
      redactor.redact("email john@example.com card 4111111111111111"),
    ).toBe("email [EMAIL] card 0000-0000-0000-0001");
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

  it("token-replace wins over mask", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "token-replace" },
        payment_card: { action: "mask", preserve: { first: 4, last: 4 } },
      },
    });
    expect(
      redactor.redact("email john@example.com card 4111111111111111"),
    ).toBe("email redacted@example card 4111********1111");
  });
});

describe("token-replace: restoration", () => {
  it("works with restore: true", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "token-replace" },
        us_ssn: { action: "token-replace" },
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

describe("token-replace: validation", () => {
  it("rejects unknown keys on token-replace setting", () => {
    expect(() =>
      createRedactor({
        rules: {
          // @ts-expect-error -- testing invalid config
          email: { action: "token-replace", replacement: "[EMAIL]" },
        },
      }),
    ).toThrow();
  });

  it("rejects non-string token values", () => {
    expect(() =>
      createRedactor({
        rules: {
          // @ts-expect-error -- testing invalid config
          email: { action: "token-replace", tokens: { email: 123 } },
        },
      }),
    ).toThrow();
  });

  it("rejects non-record tokens", () => {
    expect(() =>
      createRedactor({
        rules: {
          // @ts-expect-error -- testing invalid config
          email: { action: "token-replace", tokens: "not-a-record" },
        },
      }),
    ).toThrow();
  });
});

describe("token-replace: multiple entity types", () => {
  const redactor = createRedactor({
    rules: {
      email: { action: "token-replace" },
      payment_card: { action: "token-replace" },
      us_ssn: { action: "token-replace" },
      phone: { action: "token-replace" },
      uk_nino: { action: "token-replace" },
      iban: { action: "token-replace" },
    },
  });

  it("handles mixed entities", () => {
    const result = redactor.redact(
      "email john@example.com card 4111111111111111 ssn 123-45-6789 phone +1-415-555-1234 nino AB123456C iban SE4550000000058398257466",
    );
    expect(result).toBe(
      "email redacted@example card 0000-0000-0000-0001 ssn 000-00-0001 phone +0-000-0000 nino DA000000A iban XX00XXXX000000000000000",
    );
  });
});
