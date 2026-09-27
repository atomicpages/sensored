import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    us_dea: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// DEA format: 2 letters + 7 digits. Last digit = sum of first 6 digits mod 10.
// Valid example: BJ6125301 → digits: 6125301, first 6: 612530, sum=6+1+2+5+3+0=17, 17%10=7, last=1. Invalid.
// Let me find valid ones:
// AB1234566: digits 1234566, first 6: 123456, sum=1+2+3+4+5+6=21, 21%10=1, last=6. Invalid.
// AB1234561: digits 1234561, first 6: 123456, sum=21, 21%10=1, last=1 ✓
// So AB1234561 is valid.
// BB7654322: digits 7654322, first 6: 765432, sum=7+6+5+4+3+2=27, 27%10=7, last=2. Invalid.
// BB7654327: digits 7654327, first 6: 765432, sum=27, 27%10=7, last=7 ✓
// So BB7654327 is valid.

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["DEA: AB1234561", "DEA: [US_DEA]"],
  ["DEA: BB7654327", "DEA: [US_DEA]"],
  ["DEA: AB1234561 here", "DEA: [US_DEA] here"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match invalid checksum", () => {
  expect(redact("AB1234566")).toBe("AB1234566");
});

test("does not match excluded first letter", () => {
  expect(redact("EB1234561")).toBe("EB1234561");
  expect(redact("NB1234561")).toBe("NB1234561");
  expect(redact("SB1234561")).toBe("SB1234561");
});

test("does not match too short", () => {
  expect(redact("AB123456")).toBe("AB123456");
});

test("does not match inside a larger word", () => {
  expect(redact("fooAB1234561bar")).toBe("fooAB1234561bar");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("AB1234561 (DEA)")).toBe("[US_DEA] (DEA)");
});

test("matches at end of text", () => {
  expect(redact("DEA: AB1234561")).toBe("DEA: [US_DEA]");
});

test("trailing period is preserved", () => {
  expect(redact("DEA AB1234561.")).toBe("DEA [US_DEA].");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "DEA: AB1234561";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("DEA: [US_DEA]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_AB1234561")).toBe("_AB1234561");
  expect(redact("AB1234561_")).toBe("AB1234561_");
});
