import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    uk_sort_code: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["sort code: 12-34-56", "sort code: [UK_SORT_CODE]"],
  ["sort code: 12 34 56", "sort code: [UK_SORT_CODE]"],
  ["Sort Code 12-34-56", "Sort Code [UK_SORT_CODE]"],
  ["sort 12-34-56", "sort [UK_SORT_CODE]"],
  ["branch code 12-34-56", "branch code [UK_SORT_CODE]"],
  ["bank code: 12 34 56", "bank code: [UK_SORT_CODE]"],
  ["Sort Code: 90-21-04 done", "Sort Code: [UK_SORT_CODE] done"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without context", () => {
  expect(redact("12-34-56")).toBe("12-34-56");
});

test("does not match with wrong context", () => {
  expect(redact("phone: 12-34-56")).toBe("phone: 12-34-56");
});

test("does not match inside a larger word", () => {
  expect(redact("foo12-34-56bar")).toBe("foo12-34-56bar");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("sort code 12-34-56 is here")).toBe(
    "sort code [UK_SORT_CODE] is here",
  );
});

test("matches at end of text", () => {
  expect(redact("The sort code 12-34-56")).toBe("The sort code [UK_SORT_CODE]");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "sort code: 12-34-56";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("sort code: [UK_SORT_CODE]");
  expect(twice).toBe(once);
});
