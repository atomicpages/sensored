import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: { action: "redact" },
    ipv6: "off",
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
  ["8.8.8.8", "[IPV4]"],
  ["Server at 203.0.113.42 is up", "Server at [IPV4] is up"],
  ["1.2.3.4", "[IPV4]"],
  ["172.217.16.142", "[IPV4]"],
  ["192.0.2.1", "[IPV4]"],
  ["198.51.100.1", "[IPV4]"],
  ["Multiple: 10.0.0.1 and 8.8.4.4", "Multiple: 10.0.0.1 and [IPV4]"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases — excluded ranges
// ---------------------------------------------------------------------------

test.each([
  ["10.0.0.1", "private 10.x"],
  ["10.255.255.255", "private 10.x max"],
  ["172.16.0.1", "private 172.16.x"],
  ["172.31.255.255", "private 172.31.x max"],
  ["192.168.1.1", "private 192.168.x"],
  ["192.168.0.0", "private 192.168.x min"],
  ["127.0.0.1", "loopback"],
  ["127.255.255.255", "loopback max"],
  ["0.0.0.0", "unspecified"],
  ["255.255.255.255", "broadcast"],
  ["172.15.0.1", "not private (below range) — should detect"],
  ["172.32.0.1", "not private (above range) — should detect"],
])("excludes %s (%s)", (input, label) => {
  if (label.includes("should detect")) {
    expect(redact(input)).toBe("[IPV4]");
  } else {
    expect(redact(input)).toBe(input);
  }
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("does not match inside a larger word", () => {
  expect(redact("foo8.8.8.8bar")).toBe("foo8.8.8.8bar");
});

test("matches at start of text", () => {
  expect(redact("8.8.8.8 is DNS")).toBe("[IPV4] is DNS");
});

test("matches at end of text", () => {
  expect(redact("DNS is 8.8.8.8")).toBe("DNS is [IPV4]");
});

test("matches multiple addresses", () => {
  expect(redact("1.2.3.4 and 5.6.7.8")).toBe("[IPV4] and [IPV4]");
});

test("trailing period is preserved", () => {
  expect(redact("Server 8.8.8.8.")).toBe("Server [IPV4].");
});

test("each octet validates 0-255", () => {
  expect(redact("256.1.1.1")).toBe("256.1.1.1");
  expect(redact("1.256.1.1")).toBe("1.256.1.1");
  expect(redact("1.1.256.1")).toBe("1.1.256.1");
  expect(redact("1.1.1.256")).toBe("1.1.1.256");
});

test("matches 0.x.x.x when not 0.0.0.0", () => {
  expect(redact("0.1.2.3")).toBe("[IPV4]");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Server at 8.8.8.8";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Server at [IPV4]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_8.8.8.8")).toBe("_8.8.8.8");
  expect(redact("8.8.8.8_")).toBe("8.8.8.8_");
});
