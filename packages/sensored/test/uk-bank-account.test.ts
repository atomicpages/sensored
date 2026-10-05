import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    uk_bank_account: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["account number: 12345678", "account number: [UK_BANK_ACCOUNT]"],
  ["account no: 12345678", "account no: [UK_BANK_ACCOUNT]"],
  ["Account Number 12345678", "Account Number [UK_BANK_ACCOUNT]"],
  ["acct no: 87654321", "acct no: [UK_BANK_ACCOUNT]"],
  ["acct number: 12345678", "acct number: [UK_BANK_ACCOUNT]"],
  ["bank account: 12345678", "bank account: [UK_BANK_ACCOUNT]"],
  ["Account Number: 12345678 done", "Account Number: [UK_BANK_ACCOUNT] done"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without context", () => {
  expect(redact("12345678")).toBe("12345678");
});

test("does not match with wrong context", () => {
  expect(redact("phone: 12345678")).toBe("phone: 12345678");
});

test("does not match too short", () => {
  expect(redact("account number: 1234567")).toBe("account number: 1234567");
});

test("does not match inside a larger word", () => {
  expect(redact("foo12345678bar")).toBe("foo12345678bar");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("account number 12345678 is here")).toBe(
    "account number [UK_BANK_ACCOUNT] is here",
  );
});

test("matches at end of text", () => {
  expect(redact("The account number 12345678")).toBe(
    "The account number [UK_BANK_ACCOUNT]",
  );
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "account number: 12345678";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("account number: [UK_BANK_ACCOUNT]");
  expect(twice).toBe(once);
});
