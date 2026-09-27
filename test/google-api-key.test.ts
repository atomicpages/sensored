import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    aws_access_key: "off",
    google_api_key: { action: "redact" },
    stripe_api_key: "off",
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
  ["AIzaSyA1234567890abcdefghijklmnopqrstuv", "[GOOGLE_API_KEY]"],
  ["AIzaSyD-1234567890abcdefghijklmnopqrstu", "[GOOGLE_API_KEY]"],
  ["AIzaSyB_1234567890abcdefghijklmnopqrstu", "[GOOGLE_API_KEY]"],
  [
    "Key: AIzaSyA1234567890abcdefghijklmnopqrstuv here",
    "Key: [GOOGLE_API_KEY] here",
  ],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match lowercase aiza prefix", () => {
  expect(redact("aizaSyA1234567890abcdefghijklmnopqrstuvw")).toBe(
    "aizaSyA1234567890abcdefghijklmnopqrstuvw",
  );
});

test("does not match without AIza prefix", () => {
  expect(redact("BIzaSyA1234567890abcdefghijklmnopqrstuvw")).toBe(
    "BIzaSyA1234567890abcdefghijklmnopqrstuvw",
  );
});

test("does not match too short", () => {
  expect(redact("AIzaSyA1234567890abcdefghijklmnopqrstu")).toBe(
    "AIzaSyA1234567890abcdefghijklmnopqrstu",
  );
});

test("does not match inside a larger word", () => {
  expect(redact("fooAIzaSyA1234567890abcdefghijklmnopqrstuvbar")).toBe(
    "fooAIzaSyA1234567890abcdefghijklmnopqrstuvbar",
  );
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("AIzaSyA1234567890abcdefghijklmnopqrstuv is the key")).toBe(
    "[GOOGLE_API_KEY] is the key",
  );
});

test("matches at end of text", () => {
  expect(redact("The key is AIzaSyA1234567890abcdefghijklmnopqrstuv")).toBe(
    "The key is [GOOGLE_API_KEY]",
  );
});

test("trailing period is preserved", () => {
  expect(redact("Key AIzaSyA1234567890abcdefghijklmnopqrstuv.")).toBe(
    "Key [GOOGLE_API_KEY].",
  );
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Key: AIzaSyA1234567890abcdefghijklmnopqrstuv";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Key: [GOOGLE_API_KEY]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_AIzaSyA1234567890abcdefghijklmnopqrstuv")).toBe(
    "_AIzaSyA1234567890abcdefghijklmnopqrstuv",
  );
  expect(redact("AIzaSyA1234567890abcdefghijklmnopqrstuv_")).toBe(
    "AIzaSyA1234567890abcdefghijklmnopqrstuv_",
  );
});
