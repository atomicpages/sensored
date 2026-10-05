import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    github_token: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["ghp_1234567890abcdefghijklmnopqrstuvwxyz1234", "[GITHUB_TOKEN]"],
  ["gho_1234567890abcdefghijklmnopqrstuvwxyz1234", "[GITHUB_TOKEN]"],
  ["ghu_1234567890abcdefghijklmnopqrstuvwxyz1234", "[GITHUB_TOKEN]"],
  ["ghs_1234567890abcdefghijklmnopqrstuvwxyz1234", "[GITHUB_TOKEN]"],
  ["ghr_1234567890abcdefghijklmnopqrstuvwxyz1234", "[GITHUB_TOKEN]"],
  [
    "Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz1234 here",
    "Token: [GITHUB_TOKEN] here",
  ],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without valid prefix", () => {
  expect(redact("ghx_1234567890abcdefghijklmnopqrstuvwxyz1234")).toBe(
    "ghx_1234567890abcdefghijklmnopqrstuvwxyz1234",
  );
});

test("does not match too short", () => {
  expect(redact("ghp_1234567890abcdefghijklmnop")).toBe(
    "ghp_1234567890abcdefghijklmnop",
  );
});

test("does not match inside a larger word", () => {
  expect(redact("fooghp_1234567890abcdefghijklmnopqrstuvwxyz1234bar")).toBe(
    "fooghp_1234567890abcdefghijklmnopqrstuvwxyz1234bar",
  );
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(
    redact("ghp_1234567890abcdefghijklmnopqrstuvwxyz1234 is the token"),
  ).toBe("[GITHUB_TOKEN] is the token");
});

test("matches at end of text", () => {
  expect(
    redact("The token is ghp_1234567890abcdefghijklmnopqrstuvwxyz1234"),
  ).toBe("The token is [GITHUB_TOKEN]");
});

test("trailing period is preserved", () => {
  expect(redact("Token ghp_1234567890abcdefghijklmnopqrstuvwxyz1234.")).toBe(
    "Token [GITHUB_TOKEN].",
  );
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz1234";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Token: [GITHUB_TOKEN]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_ghp_1234567890abcdefghijklmnopqrstuvwxyz1234")).toBe(
    "_ghp_1234567890abcdefghijklmnopqrstuvwxyz1234",
  );
  expect(redact("ghp_1234567890abcdefghijklmnopqrstuvwxyz1234_")).toBe(
    "ghp_1234567890abcdefghijklmnopqrstuvwxyz1234_",
  );
});
