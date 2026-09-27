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
    stripe_api_key: "off",
    slack_token: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["xoxb-1234567890-abcdefghij", "[SLACK_TOKEN]"],
  ["xoxp-1234567890-abcdefghij", "[SLACK_TOKEN]"],
  ["xoxa-1234567890-abcdefghij", "[SLACK_TOKEN]"],
  ["xoxr-1234567890-abcdefghij", "[SLACK_TOKEN]"],
  ["xoxs-1234567890-abcdefghij", "[SLACK_TOKEN]"],
  ["xoxb-1234567890123-1234567890123-abcdefghij", "[SLACK_TOKEN]"],
  ["Token: xoxb-1234567890-abcdefghij here", "Token: [SLACK_TOKEN] here"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match too short after hyphen", () => {
  expect(redact("xoxb-123456789")).toBe("xoxb-123456789");
});

test("does not match invalid prefix letter", () => {
  expect(redact("xoxc-1234567890-abcdefghij")).toBe(
    "xoxc-1234567890-abcdefghij",
  );
});

test("does not match too short", () => {
  expect(redact("xoxb-123456789")).toBe("xoxb-123456789");
});

test("does not match inside a larger word", () => {
  expect(redact("fooxoxb-1234567890-abcdefghijbar")).toBe(
    "fooxoxb-1234567890-abcdefghijbar",
  );
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("xoxb-1234567890-abcdefghij is the token")).toBe(
    "[SLACK_TOKEN] is the token",
  );
});

test("matches at end of text", () => {
  expect(redact("The token is xoxb-1234567890-abcdefghij")).toBe(
    "The token is [SLACK_TOKEN]",
  );
});

test("trailing period is preserved", () => {
  expect(redact("Token xoxb-1234567890-abcdefghij.")).toBe(
    "Token [SLACK_TOKEN].",
  );
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Token: xoxb-1234567890-abcdefghij";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Token: [SLACK_TOKEN]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_xoxb-1234567890-abcdefghij")).toBe(
    "_xoxb-1234567890-abcdefghij",
  );
  expect(redact("xoxb-1234567890-abcdefghij_")).toBe(
    "xoxb-1234567890-abcdefghij_",
  );
});
