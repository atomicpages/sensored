import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    us_ein: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// EIN format: XX-XXXXXXX (2 digits, hyphen, 7 digits)
// Valid examples: 01-2345678, 47-1234567

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["EIN: 01-2345678", "EIN: [US_EIN]"],
  ["EIN: 47-1234567", "EIN: [US_EIN]"],
  ["EIN: 99-9999999", "EIN: [US_EIN]"],
  ["EIN: 012345678", "EIN: [US_EIN]"],
  ["EIN: 01 2345678", "EIN: [US_EIN]"],
  ["EIN: 01-2345678 here", "EIN: [US_EIN] here"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match too short", () => {
  expect(redact("01-234567")).toBe("01-234567");
});

test("does not match inside a larger word", () => {
  expect(redact("foo01-2345678bar")).toBe("foo01-2345678bar");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("01-2345678 (EIN)")).toBe("[US_EIN] (EIN)");
});

test("matches at end of text", () => {
  expect(redact("EIN: 01-2345678")).toBe("EIN: [US_EIN]");
});

test("trailing period is preserved", () => {
  expect(redact("EIN 01-2345678.")).toBe("EIN [US_EIN].");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "EIN: 01-2345678";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("EIN: [US_EIN]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_01-2345678")).toBe("_01-2345678");
  expect(redact("01-2345678_")).toBe("01-2345678_");
});
