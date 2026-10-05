import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    us_routing: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// Valid routing numbers (pass checksum):
// 021000021 (JPMorgan Chase)
// 026073150 (Bank of America)
// 111000025 (Wells Fargo)
// 121042882 (Wells Fargo)

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["Routing: 021000021", "Routing: [US_ROUTING]"],
  ["Routing: 026073150", "Routing: [US_ROUTING]"],
  ["Routing: 111000025", "Routing: [US_ROUTING]"],
  ["Routing: 121042882", "Routing: [US_ROUTING]"],
  ["Routing: 021000021 here", "Routing: [US_ROUTING] here"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match invalid checksum", () => {
  expect(redact("123456789")).toBe("123456789");
});

test("does not match too short", () => {
  expect(redact("12345678")).toBe("12345678");
});

test("does not match inside a larger word", () => {
  expect(redact("foo021000021bar")).toBe("foo021000021bar");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("021000021 (Routing)")).toBe("[US_ROUTING] (Routing)");
});

test("matches at end of text", () => {
  expect(redact("Routing: 021000021")).toBe("Routing: [US_ROUTING]");
});

test("trailing period is preserved", () => {
  expect(redact("Routing 021000021.")).toBe("Routing [US_ROUTING].");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Routing: 021000021";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Routing: [US_ROUTING]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_021000021")).toBe("_021000021");
  expect(redact("021000021_")).toBe("021000021_");
});
