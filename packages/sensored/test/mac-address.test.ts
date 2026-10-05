import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: { action: "redact" },
    url_with_auth: "off",
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["00:1A:2B:3C:4D:5E", "[MAC_ADDRESS]"],
  ["00-1A-2B-3C-4D-5E", "[MAC_ADDRESS]"],
  ["ff:ff:ff:ff:ff:ff", "[MAC_ADDRESS]"],
  ["FF:FF:FF:FF:FF:FF", "[MAC_ADDRESS]"],
  ["01:23:45:67:89:ab", "[MAC_ADDRESS]"],
  ["01-23-45-67-89-ab", "[MAC_ADDRESS]"],
  ["Device 00:1A:2B:3C:4D:5E online", "Device [MAC_ADDRESS] online"],
  ["MAC: 00-1A-2B-3C-4D-5E", "MAC: [MAC_ADDRESS]"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match 5 groups", () => {
  expect(redact("00:1A:2B:3C:4D")).toBe("00:1A:2B:3C:4D");
});

test("does not match 7 groups", () => {
  expect(redact("00:1A:2B:3C:4D:5E:6F")).toBe("00:1A:2B:3C:4D:5E:6F");
});

test("does not match mixed separators", () => {
  expect(redact("00:1A-2B:3C-4D:5E")).toBe("00:1A-2B:3C-4D:5E");
});

test("does not match inside a larger word", () => {
  expect(redact("foo00:1A:2B:3C:4D:5Ebar")).toBe("foo00:1A:2B:3C:4D:5Ebar");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("00:1A:2B:3C:4D:5E is MAC")).toBe("[MAC_ADDRESS] is MAC");
});

test("matches at end of text", () => {
  expect(redact("MAC is 00:1A:2B:3C:4D:5E")).toBe("MAC is [MAC_ADDRESS]");
});

test("matches multiple addresses", () => {
  expect(redact("00:1A:2B:3C:4D:5E and 00:1A:2B:3C:4D:5F")).toBe(
    "[MAC_ADDRESS] and [MAC_ADDRESS]",
  );
});

test("trailing period is preserved", () => {
  expect(redact("MAC 00:1A:2B:3C:4D:5E.")).toBe("MAC [MAC_ADDRESS].");
});

test("lowercase hex is detected", () => {
  expect(redact("00:1a:2b:3c:4d:5e")).toBe("[MAC_ADDRESS]");
});

test("mixed case hex is detected", () => {
  expect(redact("00:1A:2b:3C:4d:5E")).toBe("[MAC_ADDRESS]");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Device 00:1A:2B:3C:4D:5E";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Device [MAC_ADDRESS]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_00:1A:2B:3C:4D:5E")).toBe("_00:1A:2B:3C:4D:5E");
  expect(redact("00:1A:2B:3C:4D:5E_")).toBe("00:1A:2B:3C:4D:5E_");
});
