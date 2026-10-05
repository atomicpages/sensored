import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    us_npi: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// NPI uses Luhn with prefix 80840. Valid NPI: 10 digits, Luhn check passes.
// 1234567893: 808401234567893 → Luhn check
// Let me compute: 808401234567893
// From right: 3*1=3, 9*2=18→9, 8*1=8, 7*2=14→5, 6*1=6, 5*2=10→1, 4*1=4, 3*2=6, 2*1=2, 1*2=2, 0*1=0, 4*2=8, 8*1=8, 0*2=0, 8*1=8
// Sum: 3+9+8+5+6+1+4+6+2+2+0+8+8+0+8 = 70, 70%10=0 ✓
// So 1234567893 is valid.

// 1932592710: 808401932592710
// From right: 0*1=0, 1*2=2, 7*1=7, 2*2=4, 9*1=9, 5*2=10→1, 2*1=2, 3*2=6, 9*1=9, 1*2=2, 0*1=0, 4*2=8, 8*1=8, 0*2=0, 8*1=8
// Sum: 0+2+7+4+9+1+2+6+9+2+0+8+8+0+8 = 66, 66%10=6 ≠ 0. Invalid.

// Let me find another valid one:
// 1679579215: 808401679579215
// From right: 5*1=5, 1*2=2, 2*1=2, 9*2=18→9, 7*1=7, 5*2=10→1, 9*1=9, 7*2=14→5, 6*1=6, 1*2=2, 0*1=0, 4*2=8, 8*1=8, 0*2=0, 8*1=8
// Sum: 5+2+2+9+7+1+9+5+6+2+0+8+8+0+8 = 72, 72%10=2 ≠ 0. Invalid.

// Let me just use 1234567893 which I verified above.

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["1234567893", "[US_NPI]"],
  ["NPI: 1234567893 here", "NPI: [US_NPI] here"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match invalid checksum", () => {
  expect(redact("1234567890")).toBe("1234567890");
});

test("does not match too short", () => {
  expect(redact("123456789")).toBe("123456789");
});

test("does not match inside a larger word", () => {
  expect(redact("foo1234567893bar")).toBe("foo1234567893bar");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("1234567893 is the NPI")).toBe("[US_NPI] is the NPI");
});

test("matches at end of text", () => {
  expect(redact("The NPI is 1234567893")).toBe("The NPI is [US_NPI]");
});

test("trailing period is preserved", () => {
  expect(redact("NPI 1234567893.")).toBe("NPI [US_NPI].");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "NPI: 1234567893";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("NPI: [US_NPI]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_1234567893")).toBe("_1234567893");
  expect(redact("1234567893_")).toBe("1234567893_");
});
