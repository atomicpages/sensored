import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    aws_access_key: "off",
    google_api_key: "off",
    stripe_api_key: { action: "redact" },
    slack_token: "off",
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["sk_live_1234567890abcdefghijklmnopqrstuv", "[STRIPE_API_KEY]"],
  ["pk_live_1234567890abcdefghijklmnopqrstuv", "[STRIPE_API_KEY]"],
  ["sk_test_1234567890abcdefghijklmnopqrstuv", "[STRIPE_API_KEY]"],
  ["pk_test_1234567890abcdefghijklmnopqrstuv", "[STRIPE_API_KEY]"],
  ["sk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456", "[STRIPE_API_KEY]"],
  [
    "Key: sk_live_1234567890abcdefghijklmnopqrstuv here",
    "Key: [STRIPE_API_KEY] here",
  ],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without valid prefix", () => {
  expect(redact("sk_prod_1234567890abcdefghijklmnopqrstuv")).toBe(
    "sk_prod_1234567890abcdefghijklmnopqrstuv",
  );
});

test("does not match too short", () => {
  expect(redact("sk_live_1234567890abcdefghij")).toBe(
    "sk_live_1234567890abcdefghij",
  );
});

test("does not match inside a larger word", () => {
  expect(redact("foosk_live_1234567890abcdefghijklmnopqrstuvbar")).toBe(
    "foosk_live_1234567890abcdefghijklmnopqrstuvbar",
  );
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("sk_live_1234567890abcdefghijklmnopqrstuv is the key")).toBe(
    "[STRIPE_API_KEY] is the key",
  );
});

test("matches at end of text", () => {
  expect(redact("The key is sk_live_1234567890abcdefghijklmnopqrstuv")).toBe(
    "The key is [STRIPE_API_KEY]",
  );
});

test("trailing period is preserved", () => {
  expect(redact("Key sk_live_1234567890abcdefghijklmnopqrstuv.")).toBe(
    "Key [STRIPE_API_KEY].",
  );
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Key: sk_live_1234567890abcdefghijklmnopqrstuv";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Key: [STRIPE_API_KEY]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_sk_live_1234567890abcdefghijklmnopqrstuv")).toBe(
    "_sk_live_1234567890abcdefghijklmnopqrstuv",
  );
  expect(redact("sk_live_1234567890abcdefghijklmnopqrstuv_")).toBe(
    "sk_live_1234567890abcdefghijklmnopqrstuv_",
  );
});
