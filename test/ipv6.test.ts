import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: { action: "redact" },
    mac_address: "off",
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
  ["2001:0db8:85a3:0000:0000:8a2e:0370:7334", "[IPV6]"],
  ["2001:db8:85a3:0:0:8a2e:370:7334", "[IPV6]"],
  ["2001:db8:85a3::8a2e:370:7334", "[IPV6]"],
  ["2001:db8::1", "[IPV6]"],
  ["::ffff:192.0.2.1", "[IPV6]"],
  ["2a00:1450:4001:80b::200e", "[IPV6]"],
  ["2606:4700:4700::1111", "[IPV6]"],
  ["fe00::1", "[IPV6]"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases — excluded addresses
// ---------------------------------------------------------------------------

test.each([
  ["::1", "loopback"],
  ["::", "unspecified"],
  ["fe80::1", "link-local"],
  ["fe80::", "link-local prefix"],
  ["FE80::1", "link-local uppercase"],
])("excludes %s (%s)", (input, _label) => {
  expect(redact(input)).toBe(input);
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("does not match inside a larger word", () => {
  expect(redact("foo2001:db8::1bar")).toBe("foo2001:db8::1bar");
});

test("matches at start of text", () => {
  expect(redact("2001:db8::1 is IPv6")).toBe("[IPV6] is IPv6");
});

test("matches at end of text", () => {
  expect(redact("IPv6 is 2001:db8::1")).toBe("IPv6 is [IPV6]");
});

test("matches multiple addresses", () => {
  expect(redact("2001:db8::1 and 2001:db8::2")).toBe("[IPV6] and [IPV6]");
});

test("trailing period is preserved", () => {
  expect(redact("Server 2001:db8::1.")).toBe("Server [IPV6].");
});

test("full 8-group form is detected", () => {
  expect(redact("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe("[IPV6]");
});

test("compressed form with leading :: is detected", () => {
  expect(redact("::ffff:8.8.8.8")).toBe("[IPV6]");
});

test("compressed form with trailing :: is detected", () => {
  expect(redact("2001:db8::")).toBe("[IPV6]");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Server at 2001:db8::1";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Server at [IPV6]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_2001:db8::1")).toBe("_2001:db8::1");
  expect(redact("2001:db8::1_")).toBe("2001:db8::1_");
});
