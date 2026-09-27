import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    generic_api_key: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["api_key: abcdefghij1234567890abcd", "api_key: [GENERIC_API_KEY]"],
  ["apikey=abcdefghij1234567890abcd", "apikey=[GENERIC_API_KEY]"],
  ["api.key: abcdefghij1234567890abcd", "api.key: [GENERIC_API_KEY]"],
  ["api token: abcdefghij1234567890abcd", "api token: [GENERIC_API_KEY]"],
  ["api_token=abcdefghij1234567890abcd", "api_token=[GENERIC_API_KEY]"],
  [
    "Config api_key: abcdefghij1234567890abcd done",
    "Config api_key: [GENERIC_API_KEY] done",
  ],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without label", () => {
  expect(redact("abcdefghij1234567890abcd")).toBe("abcdefghij1234567890abcd");
});

test("does not match too short", () => {
  expect(redact("api_key: abcdefghij1234")).toBe("api_key: abcdefghij1234");
});

test("does not match placeholder values", () => {
  expect(redact("api_key: example1234567890abcd")).toBe(
    "api_key: example1234567890abcd",
  );
  expect(redact("api_key: test1234567890abcdefghij")).toBe(
    "api_key: test1234567890abcdefghij",
  );
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("api_key: abcdefghij1234567890abcd is the key")).toBe(
    "api_key: [GENERIC_API_KEY] is the key",
  );
});

test("matches at end of text", () => {
  expect(redact("The key is api_key: abcdefghij1234567890abcd")).toBe(
    "The key is api_key: [GENERIC_API_KEY]",
  );
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Config: api_key: abcdefghij1234567890abcd";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Config: api_key: [GENERIC_API_KEY]");
  expect(twice).toBe(once);
});
