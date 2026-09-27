import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["https://user:pass@example.com", "[URL_WITH_AUTH]"],
  ["http://admin:secret@internal.host/api", "[URL_WITH_AUTH]"],
  ["ftp://user:pass@ftp.example.com/file", "[URL_WITH_AUTH]"],
  [
    "Connect to https://user:pass@example.com/api",
    "Connect to [URL_WITH_AUTH]",
  ],
  ["https://user:p@ss@example.com/path", "[URL_WITH_AUTH]"],
  ["https://token:abc123@service.io/v1/data", "[URL_WITH_AUTH]"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match URL without credentials", () => {
  expect(redact("https://example.com/api")).toBe("https://example.com/api");
});

test("does not match URL with empty password", () => {
  expect(redact("https://user:@example.com")).toBe("https://user:@example.com");
});

test("does not match URL with empty username", () => {
  expect(redact("https://:pass@example.com")).toBe("https://:pass@example.com");
});

test("does not match non-HTTP scheme", () => {
  expect(redact("ssh://user:pass@example.com")).toBe(
    "ssh://user:pass@example.com",
  );
});

test("does not match inside a larger word", () => {
  expect(redact("foohttps://user:pass@example.combar")).toBe(
    "foohttps://user:pass@example.combar",
  );
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("https://user:pass@example.com is the URL")).toBe(
    "[URL_WITH_AUTH] is the URL",
  );
});

test("matches at end of text", () => {
  expect(redact("URL is https://user:pass@example.com")).toBe(
    "URL is [URL_WITH_AUTH]",
  );
});

test("matches multiple URLs", () => {
  expect(redact("https://a:b@x.com and https://c:d@y.com")).toBe(
    "[URL_WITH_AUTH] and [URL_WITH_AUTH]",
  );
});

test("trailing period is preserved", () => {
  expect(redact("URL https://user:pass@example.com.")).toBe(
    "URL [URL_WITH_AUTH].",
  );
});

test("URL with port is detected", () => {
  expect(redact("https://user:pass@example.com:8080/api")).toBe(
    "[URL_WITH_AUTH]",
  );
});

test("URL with query string is detected", () => {
  expect(redact("https://user:pass@example.com?key=value")).toBe(
    "[URL_WITH_AUTH]",
  );
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Connect to https://user:pass@example.com/api";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Connect to [URL_WITH_AUTH]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_https://user:pass@example.com")).toBe(
    "_https://user:pass@example.com",
  );
  expect(redact("https://user:pass@example.com_")).toBe(
    "https://user:pass@example.com_",
  );
});
