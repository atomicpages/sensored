import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    nz_ird: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// NZ IRD: 8-9 digits with checksum (weights 3,2,7,6,5,4,3,2, check digit)
// Valid example: 136-410-132 → 136410132
// Check: 1*3+3*2+6*7+4*6+1*5+0*4+1*3+3*2 = 3+6+42+24+5+0+3+6 = 89, 89%11=1, check=10 ≠ 2
// Let me find a valid one:
// 136-410-132: 1*3+3*2+6*7+4*6+1*5+0*4+1*3+3*2 = 3+6+42+24+5+0+3+6 = 89, 89%11=1, 11-1=10, but check digit is 2. Invalid.
// Let me try 136-410-148: 1*3+3*2+6*7+4*6+1*5+0*4+1*3+4*2 = 3+6+42+24+5+0+3+8 = 91, 91%11=3, 11-3=8, check=8 ✓
// So 136410148 is valid.
// Also: 490-918-649: 4*3+9*2+0*7+9*6+1*5+8*4+6*3+4*2 = 12+18+0+54+5+32+18+8 = 147, 147%11=4, 11-4=7, check=9. Invalid.
// Let me try 490-918-647: 4*3+9*2+0*7+9*6+1*5+8*4+6*3+4*2 = 147, 147%11=4, 11-4=7, check=7 ✓
// So 490918647 is valid.

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["IRD: 136410148", "IRD: [NZ_IRD]"],
  ["IRD: 136-410-148", "IRD: [NZ_IRD]"],
  ["IRD: 136 410 148", "IRD: [NZ_IRD]"],
  ["IRD: 490918647", "IRD: [NZ_IRD]"],
  ["IRD: 490-918-647", "IRD: [NZ_IRD]"],
  ["IRD: 136410148 here", "IRD: [NZ_IRD] here"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match invalid checksum", () => {
  expect(redact("136410132")).toBe("136410132");
});

test("does not match too short", () => {
  expect(redact("1364101")).toBe("1364101");
});

test("does not match inside a larger word", () => {
  expect(redact("foo136410148bar")).toBe("foo136410148bar");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("136410148 (IRD)")).toBe("[NZ_IRD] (IRD)");
});

test("matches at end of text", () => {
  expect(redact("IRD: 136410148")).toBe("IRD: [NZ_IRD]");
});

test("trailing period is preserved", () => {
  expect(redact("IRD 136410148.")).toBe("IRD [NZ_IRD].");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "IRD: 136410148";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("IRD: [NZ_IRD]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_136410148")).toBe("_136410148");
  expect(redact("136410148_")).toBe("136410148_");
});
