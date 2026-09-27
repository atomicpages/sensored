import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    us_itin: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// ITIN format: 9XX-7X-XXXX or 9XX-8X-XXXX where XX is 70-88
// Valid examples: 970-70-1234, 980-88-5678, 999-88-9999

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["ITIN: 970-70-1234", "ITIN: [US_ITIN]"],
  ["ITIN: 980-88-5678", "ITIN: [US_ITIN]"],
  ["ITIN: 999-88-9999", "ITIN: [US_ITIN]"],
  ["ITIN: 970701234", "ITIN: [US_ITIN]"],
  ["ITIN: 980 88 5678", "ITIN: [US_ITIN]"],
  ["ITIN: 970-70-1234 here", "ITIN: [US_ITIN] here"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match invalid middle digits", () => {
  expect(redact("970-69-1234")).toBe("970-69-1234");
  expect(redact("970-89-1234")).toBe("970-89-1234");
});

test("does not match non-9 prefix", () => {
  expect(redact("870-70-1234")).toBe("870-70-1234");
});

test("does not match inside a larger word", () => {
  expect(redact("foo970-70-1234bar")).toBe("foo970-70-1234bar");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("970-70-1234 (ITIN)")).toBe("[US_ITIN] (ITIN)");
});

test("matches at end of text", () => {
  expect(redact("ITIN: 970-70-1234")).toBe("ITIN: [US_ITIN]");
});

test("trailing period is preserved", () => {
  expect(redact("ITIN 970-70-1234.")).toBe("ITIN [US_ITIN].");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "ITIN: 970-70-1234";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("ITIN: [US_ITIN]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_970-70-1234")).toBe("_970-70-1234");
  expect(redact("970-70-1234_")).toBe("970-70-1234_");
});
