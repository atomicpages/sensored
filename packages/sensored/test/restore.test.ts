import { describe, expect, it } from "bun:test";
import type { RedactorConfig } from "../src";
import { createRedactor, type RedactResult, restore } from "../src";

const baseConfig: RedactorConfig = {
  rules: {
    email: { action: "redact" },
    payment_card: { action: "redact" },
    us_ssn: { action: "redact" },
    phone: { action: "redact" },
    uk_nino: { action: "redact" },
    ca_sin: { action: "redact" },
    au_tfn: { action: "redact" },
    jp_my_number: { action: "redact" },
    eu_vat: { action: "redact" },
    iban: { action: "redact" },
    passport: { action: "redact" },
    drivers_license: { action: "redact" },
  },
};

describe("restoration: redact() return type", () => {
  it("returns string when restore is false", () => {
    const r = createRedactor({ ...baseConfig, restore: false });
    const result = r.redact("contact john@example.com");
    expect(typeof result).toBe("string");
  });

  it("returns string when restore is omitted", () => {
    const r = createRedactor(baseConfig);
    const result = r.redact("contact john@example.com");
    expect(typeof result).toBe("string");
  });

  it("returns { text, map } when restore is true", () => {
    const r = createRedactor({ ...baseConfig, restore: true });
    const result = r.redact("contact john@example.com");
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
    expect((result as RedactResult).text).toBeDefined();
    expect((result as RedactResult).map).toBeDefined();
  });
});

describe("restoration: basic round-trip", () => {
  it("redacts and restores a single email", () => {
    const r = createRedactor({ ...baseConfig, restore: true });
    const original = "contact john@example.com";
    const { text, map } = r.redact(original) as RedactResult;

    expect(text).toBe("contact [EMAIL_1]");
    expect(map["[EMAIL_1]"]).toBe("john@example.com");
    expect(restore(text, map)).toBe(original);
  });

  it("redacts and restores multiple emails", () => {
    const r = createRedactor({ ...baseConfig, restore: true });
    const original = "email john@example.com and jane@test.org";
    const { text, map } = r.redact(original) as RedactResult;

    expect(text).toBe("email [EMAIL_1] and [EMAIL_2]");
    expect(map["[EMAIL_1]"]).toBe("john@example.com");
    expect(map["[EMAIL_2]"]).toBe("jane@test.org");
    expect(restore(text, map)).toBe(original);
  });

  it("redacts and restores mixed entity types", () => {
    const r = createRedactor({ ...baseConfig, restore: true });
    const original = "email john@example.com or call 415-555-1234";
    const { text, map } = r.redact(original) as RedactResult;

    expect(text).toBe("email [EMAIL_1] or call [PHONE_1]");
    expect(map["[EMAIL_1]"]).toBe("john@example.com");
    expect(map["[PHONE_1]"]).toBe("415-555-1234");
    expect(restore(text, map)).toBe(original);
  });
});

describe("restoration: placeholder numbering", () => {
  it("numbers placeholders per entity type", () => {
    const r = createRedactor({ ...baseConfig, restore: true });
    const original =
      "a@x.com b@x.com c@x.com call +14155551111 or +14155552222";
    const { text, map } = r.redact(original) as RedactResult;

    expect(text).toBe(
      "[EMAIL_1] [EMAIL_2] [EMAIL_3] call [PHONE_1] or [PHONE_2]",
    );
    expect(Object.keys(map)).toHaveLength(5);
    expect(restore(text, map)).toBe(original);
  });

  it("is deterministic across multiple redactor instances", () => {
    const original = "a@x.com b@x.com call +14155551111 or +14155552222";

    const r1 = createRedactor({ ...baseConfig, restore: true });
    const r2 = createRedactor({ ...baseConfig, restore: true });

    const res1 = r1.redact(original) as RedactResult;
    const res2 = r2.redact(original) as RedactResult;

    expect(res1.text).toBe(res2.text);
    expect(res1.map).toEqual(res2.map);
  });

  it("is deterministic across multiple calls on same instance", () => {
    const r = createRedactor({ ...baseConfig, restore: true });
    const original = "a@x.com b@x.com call +14155551111";

    const res1 = r.redact(original) as RedactResult;
    const res2 = r.redact(original) as RedactResult;

    expect(res1.text).toBe(res2.text);
    expect(res1.map).toEqual(res2.map);
  });
});

describe("restoration: all actions", () => {
  it("works with redact action", () => {
    const r = createRedactor({
      rules: { email: { action: "redact" } },
      restore: true,
    });
    const original = "email john@example.com";
    const { text, map } = r.redact(original) as RedactResult;

    expect(text).toBe("email [EMAIL_1]");
    expect(restore(text, map)).toBe(original);
  });

  it("works with mask action", () => {
    const r = createRedactor({
      rules: {
        email: { action: "mask", preserve: { first: 2, last: 4 } },
      },
      restore: true,
    });
    const original = "email john@example.com";
    const { text, map } = r.redact(original) as RedactResult;

    expect(text).toBe("email [EMAIL_1]");
    expect(map["[EMAIL_1]"]).toBe("john@example.com");
    expect(restore(text, map)).toBe(original);
  });

  it("works with remove action", () => {
    const r = createRedactor({
      rules: { email: { action: "remove" } },
      restore: true,
    });
    const original = "email john@example.com";
    const { text, map } = r.redact(original) as RedactResult;

    expect(text).toBe("email [EMAIL_1]");
    expect(map["[EMAIL_1]"]).toBe("john@example.com");
    expect(restore(text, map)).toBe(original);
  });

  it("works with mixed actions", () => {
    const r = createRedactor({
      rules: {
        email: { action: "redact" },
        payment_card: { action: "mask", preserve: { first: 4, last: 4 } },
        us_ssn: { action: "remove" },
      },
      restore: true,
    });
    const original =
      "email john@example.com card 4111111111111111 ssn 123-45-6789";
    const { text, map } = r.redact(original) as RedactResult;

    expect(restore(text, map)).toBe(original);
  });
});

describe("restoration: idempotency", () => {
  it("restoring already-restored text is a no-op", () => {
    const r = createRedactor({ ...baseConfig, restore: true });
    const original = "email john@example.com and jane@test.org";
    const { text, map } = r.redact(original) as RedactResult;

    const restored = restore(text, map);
    const restoredAgain = restore(restored, map);

    expect(restoredAgain).toBe(restored);
  });

  it("restore with empty map returns text unchanged", () => {
    expect(restore("hello world", {})).toBe("hello world");
  });

  it("restore with no placeholders in text returns text unchanged", () => {
    expect(restore("hello world", { "[EMAIL_1]": "test@x.com" })).toBe(
      "hello world",
    );
  });
});

describe("restoration: all detectors", () => {
  it("restores email detections", () => {
    const r = createRedactor({
      rules: { email: { action: "redact" } },
      restore: true,
    });
    const original = "contact john@example.com";
    const { text, map } = r.redact(original) as RedactResult;
    expect(restore(text, map)).toBe(original);
  });

  it("restores payment_card detections", () => {
    const r = createRedactor({
      rules: { payment_card: { action: "redact" } },
      restore: true,
    });
    const original = "card 4111111111111111";
    const { text, map } = r.redact(original) as RedactResult;
    expect(restore(text, map)).toBe(original);
  });

  it("restores us_ssn detections", () => {
    const r = createRedactor({
      rules: { us_ssn: { action: "redact" } },
      restore: true,
    });
    const original = "SSN 123-45-6789";
    const { text, map } = r.redact(original) as RedactResult;
    expect(restore(text, map)).toBe(original);
  });

  it("restores phone detections", () => {
    const r = createRedactor({
      rules: { phone: { action: "redact" } },
      restore: true,
    });
    const original = "call 415-555-1234";
    const { text, map } = r.redact(original) as RedactResult;
    expect(restore(text, map)).toBe(original);
  });

  it("restores uk_nino detections", () => {
    const r = createRedactor({
      rules: { uk_nino: { action: "redact" } },
      restore: true,
    });
    const original = "nino AB123456C";
    const { text, map } = r.redact(original) as RedactResult;
    expect(restore(text, map)).toBe(original);
  });

  it("restores ca_sin detections", () => {
    const r = createRedactor({
      rules: { ca_sin: { action: "redact" } },
      restore: true,
    });
    const original = "sin 123456789";
    const { text, map } = r.redact(original) as RedactResult;
    expect(restore(text, map)).toBe(original);
  });

  it("restores au_tfn detections", () => {
    const r = createRedactor({
      rules: { au_tfn: { action: "redact" } },
      restore: true,
    });
    const original = "tfn 123456789";
    const { text, map } = r.redact(original) as RedactResult;
    expect(restore(text, map)).toBe(original);
  });

  it("restores jp_my_number detections", () => {
    const r = createRedactor({
      rules: { jp_my_number: { action: "redact" } },
      restore: true,
    });
    const original = "my number 123456789012";
    const { text, map } = r.redact(original) as RedactResult;
    expect(restore(text, map)).toBe(original);
  });

  it("restores eu_vat detections", () => {
    const r = createRedactor({
      rules: { eu_vat: { action: "redact" } },
      restore: true,
    });
    const original = "vat DE123456789";
    const { text, map } = r.redact(original) as RedactResult;
    expect(restore(text, map)).toBe(original);
  });

  it("restores iban detections", () => {
    const r = createRedactor({
      rules: { iban: { action: "redact" } },
      restore: true,
    });
    const original = "iban SE4550000000058398257466";
    const { text, map } = r.redact(original) as RedactResult;
    expect(restore(text, map)).toBe(original);
  });

  it("restores passport detections", () => {
    const r = createRedactor({
      rules: { passport: { action: "redact" } },
      restore: true,
    });
    const original = "Passport Number 123456789";
    const { text, map } = r.redact(original) as RedactResult;
    expect(restore(text, map)).toBe(original);
  });

  it("restores drivers_license detections", () => {
    const r = createRedactor({
      rules: { drivers_license: { action: "redact" } },
      restore: true,
    });
    const original = "Driver's License D1234567";
    const { text, map } = r.redact(original) as RedactResult;
    expect(restore(text, map)).toBe(original);
  });
});

describe("restoration: standalone restore function", () => {
  it("can be called without a redactor instance", () => {
    const text = "email [EMAIL_1] and [PHONE_1]";
    const map = {
      "[EMAIL_1]": "john@example.com",
      "[PHONE_1]": "415-555-1234",
    };

    expect(restore(text, map)).toBe("email john@example.com and 415-555-1234");
  });
});

describe("restoration: redactor.restore method", () => {
  it("restores using the method on the redactor", () => {
    const r = createRedactor({ ...baseConfig, restore: true });
    const original = "email john@example.com and jane@test.org";
    const { text, map } = r.redact(original) as RedactResult;

    expect(r.restore(text, map)).toBe(original);
  });
});

describe("restoration: backward compatibility", () => {
  it("redact without restore produces same output as before", () => {
    const r = createRedactor(baseConfig);
    const result = r.redact("email john@example.com");
    expect(result).toBe("email [EMAIL]");
  });

  it("redact with restore: false produces same output as before", () => {
    const r = createRedactor({ ...baseConfig, restore: false });
    const result = r.redact("email john@example.com");
    expect(result).toBe("email [EMAIL]");
  });
});

describe("restoration: overlap groups", () => {
  it("handles overlapping detections with restoration", () => {
    const r = createRedactor({
      rules: {
        email: { action: "redact" },
        payment_card: { action: "redact" },
      },
      restore: true,
    });
    const original = "contact 4111111111111111 john@example.com";
    const { text, map } = r.redact(original) as RedactResult;

    expect(restore(text, map)).toBe(original);
  });
});
