import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    jwt_token: "off",
    http_auth_header: "off",
    url_query_key: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  [
    "https://api.example.com?api_key=secret123",
    "https://api.example.com?api_key=[URL_QUERY_KEY]",
  ],
  [
    "https://api.example.com?api-key=secret123",
    "https://api.example.com?api-key=[URL_QUERY_KEY]",
  ],
  [
    "https://api.example.com?apikey=secret123",
    "https://api.example.com?apikey=[URL_QUERY_KEY]",
  ],
  [
    "https://api.example.com?api_token=tok_abc123",
    "https://api.example.com?api_token=[URL_QUERY_KEY]",
  ],
  [
    "https://api.example.com?access_token=abc123",
    "https://api.example.com?access_token=[URL_QUERY_KEY]",
  ],
  [
    "https://api.example.com?auth_token=abc123",
    "https://api.example.com?auth_token=[URL_QUERY_KEY]",
  ],
  [
    "https://api.example.com?secret_key=abc123",
    "https://api.example.com?secret_key=[URL_QUERY_KEY]",
  ],
  [
    "https://api.example.com?secret=abc123",
    "https://api.example.com?secret=[URL_QUERY_KEY]",
  ],
  [
    "https://api.example.com?private_key=abc123",
    "https://api.example.com?private_key=[URL_QUERY_KEY]",
  ],
  [
    "https://api.example.com?oauth_token=abc123",
    "https://api.example.com?oauth_token=[URL_QUERY_KEY]",
  ],
  [
    "https://api.example.com?access_key=abc123",
    "https://api.example.com?access_key=[URL_QUERY_KEY]",
  ],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

test("detects with hyphenated variants", () => {
  expect(redact("https://api.example.com?api-token=tok_abc123")).toBe(
    "https://api.example.com?api-token=[URL_QUERY_KEY]",
  );
  expect(redact("https://api.example.com?access-token=abc123")).toBe(
    "https://api.example.com?access-token=[URL_QUERY_KEY]",
  );
  expect(redact("https://api.example.com?auth-token=abc123")).toBe(
    "https://api.example.com?auth-token=[URL_QUERY_KEY]",
  );
  expect(redact("https://api.example.com?secret-key=abc123")).toBe(
    "https://api.example.com?secret-key=[URL_QUERY_KEY]",
  );
  expect(redact("https://api.example.com?private-key=abc123")).toBe(
    "https://api.example.com?private-key=[URL_QUERY_KEY]",
  );
  expect(redact("https://api.example.com?oauth-token=abc123")).toBe(
    "https://api.example.com?oauth-token=[URL_QUERY_KEY]",
  );
  expect(redact("https://api.example.com?access-key=abc123")).toBe(
    "https://api.example.com?access-key=[URL_QUERY_KEY]",
  );
});

test("detects with compact variants", () => {
  expect(redact("https://api.example.com?apitoken=tok_abc123")).toBe(
    "https://api.example.com?apitoken=[URL_QUERY_KEY]",
  );
  expect(redact("https://api.example.com?accesstoken=abc123")).toBe(
    "https://api.example.com?accesstoken=[URL_QUERY_KEY]",
  );
  expect(redact("https://api.example.com?authtoken=abc123")).toBe(
    "https://api.example.com?authtoken=[URL_QUERY_KEY]",
  );
  expect(redact("https://api.example.com?secretkey=abc123")).toBe(
    "https://api.example.com?secretkey=[URL_QUERY_KEY]",
  );
  expect(redact("https://api.example.com?privatekey=abc123")).toBe(
    "https://api.example.com?privatekey=[URL_QUERY_KEY]",
  );
  expect(redact("https://api.example.com?oauthtoken=abc123")).toBe(
    "https://api.example.com?oauthtoken=[URL_QUERY_KEY]",
  );
  expect(redact("https://api.example.com?accesskey=abc123")).toBe(
    "https://api.example.com?accesskey=[URL_QUERY_KEY]",
  );
});

test("detects multiple query params in same URL", () => {
  expect(redact("https://api.example.com?api_key=key1&api_token=tok1")).toBe(
    "https://api.example.com?api_key=[URL_QUERY_KEY]&api_token=[URL_QUERY_KEY]",
  );
});

test("detects with & separator in non-first position", () => {
  expect(redact("https://api.example.com?foo=bar&api_key=secret123")).toBe(
    "https://api.example.com?foo=bar&api_key=[URL_QUERY_KEY]",
  );
});

test("redacts only the value, not the key or URL", () => {
  const result = redact("https://api.example.com?api_key=secret123");
  expect(result).toContain("api_key=");
  expect(result).toContain("https://api.example.com");
  expect(result).not.toContain("secret123");
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match non-credential query params", () => {
  expect(redact("https://api.example.com?foo=bar")).toBe(
    "https://api.example.com?foo=bar",
  );
  expect(redact("https://api.example.com?q=search")).toBe(
    "https://api.example.com?q=search",
  );
});

test("does not match fragment after hash", () => {
  expect(redact("https://api.example.com?api_key=secret#fragment")).toBe(
    "https://api.example.com?api_key=[URL_QUERY_KEY]#fragment",
  );
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("?api_key=secret123 is the config")).toBe(
    "?api_key=[URL_QUERY_KEY] is the config",
  );
});

test("matches at end of text", () => {
  expect(redact("The URL is ?api_key=secret123")).toBe(
    "The URL is ?api_key=[URL_QUERY_KEY]",
  );
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "https://api.example.com?api_key=secret123";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("https://api.example.com?api_key=[URL_QUERY_KEY]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("value embedded in longer query string is matched", () => {
  expect(redact("?api_key=secret123&other=val")).toBe(
    "?api_key=[URL_QUERY_KEY]&other=val",
  );
});
