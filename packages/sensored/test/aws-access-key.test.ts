import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    aws_access_key: { action: "redact" },
    google_api_key: "off",
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
  ["AKIAIOSFODNN7EXAMPLE", "[AWS_ACCESS_KEY]"],
  ["AKIA1234567890ABCDEF", "[AWS_ACCESS_KEY]"],
  ["AKIAZZZZZZZZZZZZZZZZ", "[AWS_ACCESS_KEY]"],
  ["Key: AKIAIOSFODNN7EXAMPLE here", "Key: [AWS_ACCESS_KEY] here"],
  [
    "AKIAIOSFODNN7EXAMPLE and AKIA1234567890ABCDEF",
    "[AWS_ACCESS_KEY] and [AWS_ACCESS_KEY]",
  ],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match lowercase akia prefix", () => {
  expect(redact("akiaIOSFODNN7EXAMPLE")).toBe("akiaIOSFODNN7EXAMPLE");
});

test("does not match without AKIA prefix", () => {
  expect(redact("BKIAIOSFODNN7EXAMPLE")).toBe("BKIAIOSFODNN7EXAMPLE");
});

test("does not match too short", () => {
  expect(redact("AKIAIOSFODNN7EXAMP")).toBe("AKIAIOSFODNN7EXAMP");
});

test("does not match too long (17+ after prefix)", () => {
  expect(redact("AKIAIOSFODNN7EXAMPLEX")).toBe("AKIAIOSFODNN7EXAMPLEX");
});

test("does not match inside a larger word", () => {
  expect(redact("fooAKIAIOSFODNN7EXAMPLEbar")).toBe(
    "fooAKIAIOSFODNN7EXAMPLEbar",
  );
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("AKIAIOSFODNN7EXAMPLE is the key")).toBe(
    "[AWS_ACCESS_KEY] is the key",
  );
});

test("matches at end of text", () => {
  expect(redact("The key is AKIAIOSFODNN7EXAMPLE")).toBe(
    "The key is [AWS_ACCESS_KEY]",
  );
});

test("trailing period is preserved", () => {
  expect(redact("Key AKIAIOSFODNN7EXAMPLE.")).toBe("Key [AWS_ACCESS_KEY].");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Key: AKIAIOSFODNN7EXAMPLE";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Key: [AWS_ACCESS_KEY]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_AKIAIOSFODNN7EXAMPLE")).toBe("_AKIAIOSFODNN7EXAMPLE");
  expect(redact("AKIAIOSFODNN7EXAMPLE_")).toBe("AKIAIOSFODNN7EXAMPLE_");
});
