import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    email: { action: "redact" },
    payment_card: { action: "redact" },
    us_ssn: { action: "redact" },
  },
});

test("redacting already-redacted email is a no-op", () => {
  const original = "Contact me at john@example.com";
  const once = redactor.redact(original);
  const twice = redactor.redact(once);

  expect(once).toBe("Contact me at [EMAIL]");
  expect(twice).toBe(once);
});

test("redacting already-redacted payment card is a no-op", () => {
  const original = "Card: 4111111111111111";
  const once = redactor.redact(original);
  const twice = redactor.redact(once);

  expect(once).toBe("Card: [PAYMENT_CARD]");
  expect(twice).toBe(once);
});

test("redacting already-redacted SSN is a no-op", () => {
  const original = "SSN: 123-45-6789";
  const once = redactor.redact(original);
  const twice = redactor.redact(once);

  expect(once).toBe("SSN: [US_SSN]");
  expect(twice).toBe(once);
});

test("redacting text with [REDACTED] placeholder is a no-op for that span", () => {
  const text = "Some [REDACTED] text with john@example.com";
  const result = redactor.redact(text);

  expect(result).toBe("Some [REDACTED] text with [EMAIL]");
});

test("redacting mixed already-redacted and fresh content", () => {
  const text = "[EMAIL] and john@example.com and [PAYMENT_CARD]";
  const result = redactor.redact(text);

  expect(result).toBe("[EMAIL] and [EMAIL] and [PAYMENT_CARD]");
});

test("inspect on already-redacted text reports no detections for placeholders", () => {
  const text = "Contact [EMAIL] at [PAYMENT_CARD]";
  const result = redactor.inspect(text);

  expect(result.groups).toHaveLength(0);
  expect(result.text).toBe(text);
});

test("numbered placeholder variants are filtered", () => {
  const text = "[EMAIL_1] and john@example.com";
  const result = redactor.redact(text);

  expect(result).toBe("[EMAIL_1] and [EMAIL]");
});

test("lowercase placeholders are NOT filtered (only uppercase)", () => {
  const text = "[email] and john@example.com";
  const result = redactor.redact(text);

  expect(result).toBe("[email] and [EMAIL]");
});

test("idempotency with mask action", () => {
  const maskRedactor = createRedactor({
    rules: {
      email: { action: "mask", preserve: { first: 2, last: 4 } },
    },
  });

  const original = "Email: john@example.com";
  const once = maskRedactor.redact(original);
  const twice = maskRedactor.redact(once);

  expect(once).toBe("Email: jo**********.com");
  expect(twice).toBe(once);
});

test("idempotency with remove action", () => {
  const removeRedactor = createRedactor({
    rules: {
      email: { action: "remove" },
    },
  });

  const original = "Email: john@example.com done";
  const once = removeRedactor.redact(original);
  const twice = removeRedactor.redact(once);

  expect(once).toBe("Email:  done");
  expect(twice).toBe(once);
});

test("idempotency with mask action for payment_card", () => {
  const maskRedactor = createRedactor({
    rules: {
      payment_card: { action: "mask", preserve: { first: 4, last: 4 } },
    },
  });

  const original = "Card: 4242424242424242";
  const once = maskRedactor.redact(original);
  const twice = maskRedactor.redact(once);

  expect(once).toBe("Card: 4242********4242");
  expect(twice).toBe(once);
});

test("idempotency with remove action for payment_card", () => {
  const removeRedactor = createRedactor({
    rules: {
      payment_card: { action: "remove" },
    },
  });

  const original = "Card: 4242424242424242 done";
  const once = removeRedactor.redact(original);
  const twice = removeRedactor.redact(once);

  expect(once).toBe("Card:  done");
  expect(twice).toBe(once);
});

test("idempotency with mask action for us_ssn", () => {
  const maskRedactor = createRedactor({
    rules: {
      us_ssn: { action: "mask", preserve: { first: 3, last: 4 } },
    },
  });

  const original = "SSN: 123-45-6789";
  const once = maskRedactor.redact(original);
  const twice = maskRedactor.redact(once);

  expect(once).toBe("SSN: 123****6789");
  expect(twice).toBe(once);
});

test("idempotency with remove action for us_ssn", () => {
  const removeRedactor = createRedactor({
    rules: {
      us_ssn: { action: "remove" },
    },
  });

  const original = "SSN: 123-45-6789 done";
  const once = removeRedactor.redact(original);
  const twice = removeRedactor.redact(once);

  expect(once).toBe("SSN:  done");
  expect(twice).toBe(once);
});

test("custom replacement string is idempotent", () => {
  const customRedactor = createRedactor({
    rules: {
      email: { action: "redact", replacement: "[EMAIL_HIDDEN]" },
    },
  });

  const original = "Contact john@example.com";
  const once = customRedactor.redact(original);
  const twice = customRedactor.redact(once);

  expect(once).toBe("Contact [EMAIL_HIDDEN]");
  expect(twice).toBe(once);
});

test("multiple redactions in sequence remain stable", () => {
  const original = "john@example.com and 4111111111111111";
  let result = redactor.redact(original);

  expect(result).toBe("[EMAIL] and [PAYMENT_CARD]");

  for (let i = 0; i < 5; i++) {
    const next = redactor.redact(result);
    expect(next).toBe(result);
    result = next;
  }

  expect(result).toBe("[EMAIL] and [PAYMENT_CARD]");
});
