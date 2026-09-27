import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    swift_bic: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["BIC: DEUTDEFF", "BIC: [SWIFT_BIC]"],
  ["BIC: DEUTDEFF500", "BIC: [SWIFT_BIC]"],
  ["BIC: CHASUS33", "BIC: [SWIFT_BIC]"],
  ["BIC: BARCGB22", "BIC: [SWIFT_BIC]"],
  ["BIC: NEDSZAJJXXX", "BIC: [SWIFT_BIC]"],
  ["BIC: DEUTDEFF here", "BIC: [SWIFT_BIC] here"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match too short", () => {
  expect(redact("DEUTDE")).toBe("DEUTDE");
});

test("does not match lowercase", () => {
  expect(redact("deutdeff")).toBe("deutdeff");
});

test("does not match inside a larger word", () => {
  expect(redact("fooDEUTDEFFbar")).toBe("fooDEUTDEFFbar");
});

test("does not match 9 or 10 chars", () => {
  expect(redact("DEUTDEFF5")).toBe("DEUTDEFF5");
  expect(redact("DEUTDEFF50")).toBe("DEUTDEFF50");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("DEUTDEFF (BIC)")).toBe("[SWIFT_BIC] (BIC)");
});

test("matches at end of text", () => {
  expect(redact("BIC: DEUTDEFF")).toBe("BIC: [SWIFT_BIC]");
});

test("trailing period is preserved", () => {
  expect(redact("BIC DEUTDEFF.")).toBe("BIC [SWIFT_BIC].");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "BIC: DEUTDEFF";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("BIC: [SWIFT_BIC]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_DEUTDEFF")).toBe("_DEUTDEFF");
  expect(redact("DEUTDEFF_")).toBe("DEUTDEFF_");
});
