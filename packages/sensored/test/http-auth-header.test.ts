import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    jwt_token: "off",
    url_query_key: "off",
    http_auth_header: { action: "redact" },
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
    "Authorization: Basic dXNlcjpwYXNz",
    "Authorization: Basic [HTTP_AUTH_HEADER]",
  ],
  [
    "Proxy-Authorization: Basic dXNlcjpwYXNz",
    "Proxy-Authorization: Basic [HTTP_AUTH_HEADER]",
  ],
  [
    "Authorization: Bearer dXNlcjpwYXNz",
    "Authorization: Bearer [HTTP_AUTH_HEADER]",
  ],
  [
    "Proxy-Authorization: Bearer dXNlcjpwYXNz",
    "Proxy-Authorization: Bearer [HTTP_AUTH_HEADER]",
  ],
  [
    'Authorization: Digest username="admin"',
    "Authorization: Digest [HTTP_AUTH_HEADER]",
  ],
  [
    'Proxy-Authorization: Digest username="admin"',
    "Proxy-Authorization: Digest [HTTP_AUTH_HEADER]",
  ],
  ["Api-Key: sk-1234567890abcdef", "Api-Key: [HTTP_AUTH_HEADER]"],
  ["ApiKey: my-secret-key-123", "ApiKey: [HTTP_AUTH_HEADER]"],
  [
    "Ocp-Apim-Subscription-Key: abc123def456",
    "Ocp-Apim-Subscription-Key: [HTTP_AUTH_HEADER]",
  ],
  ["X-Api-Key: abc123def456", "X-Api-Key: [HTTP_AUTH_HEADER]"],
  ["X-Auth-Token: tok_abc123", "X-Auth-Token: [HTTP_AUTH_HEADER]"],
  ["X-Secret-Key: secret_value_here", "X-Secret-Key: [HTTP_AUTH_HEADER]"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

test("redacts only the value, not the header name", () => {
  expect(redact("Authorization: Basic dXNlcjpwYXNz")).toBe(
    "Authorization: Basic [HTTP_AUTH_HEADER]",
  );
  expect(redact("Header: Authorization: Basic dXNlcjpwYXNz")).toBe(
    "Header: Authorization: Basic [HTTP_AUTH_HEADER]",
  );
});

test("detects multiple headers in same text", () => {
  const input = "Api-Key: key1\nApi-Key: key2";
  expect(redact(input)).toBe(
    "Api-Key: [HTTP_AUTH_HEADER]\nApi-Key: [HTTP_AUTH_HEADER]",
  );
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match plain Authorization without Basic/Bearer/Digest", () => {
  expect(redact("Authorization: something")).toBe("Authorization: something");
});

test("does not match X-headers without Key/Token/Secret suffix", () => {
  expect(redact("X-Custom-Header: value123")).toBe("X-Custom-Header: value123");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("Api-Key: secret123 is configured")).toBe(
    "Api-Key: [HTTP_AUTH_HEADER] is configured",
  );
});

test("matches at end of text", () => {
  expect(redact("The key is Api-Key: secret123")).toBe(
    "The key is Api-Key: [HTTP_AUTH_HEADER]",
  );
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Api-Key: sk-1234567890abcdef";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Api-Key: [HTTP_AUTH_HEADER]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("partial header name in longer word still redacts value", () => {
  expect(redact("xApi-Key: secret123")).toBe("xApi-Key: [HTTP_AUTH_HEADER]");
});

// ---------------------------------------------------------------------------
// Custom headers via detectorOptions
// ---------------------------------------------------------------------------

test("custom string headers are detected", () => {
  const customRedactor = createRedactor({
    rules: {
      ipv4: "off",
      ipv6: "off",
      mac_address: "off",
      url_with_auth: "off",
      jwt_token: "off",
      url_query_key: "off",
      http_auth_header: { action: "redact" },
    },
    detectorOptions: {
      http_auth_header: {
        customHeaders: ["My-Custom-Auth", "X-Client-Id"],
      },
    },
  });

  expect(customRedactor.redact("My-Custom-Auth: abc123secret")).toBe(
    "My-Custom-Auth: [HTTP_AUTH_HEADER]",
  );
  expect(customRedactor.redact("X-Client-Id: client-xyz-789")).toBe(
    "X-Client-Id: [HTTP_AUTH_HEADER]",
  );
});

test("custom RegExp headers are detected", () => {
  const customRedactor = createRedactor({
    rules: {
      ipv4: "off",
      ipv6: "off",
      mac_address: "off",
      url_with_auth: "off",
      jwt_token: "off",
      url_query_key: "off",
      http_auth_header: { action: "redact" },
    },
    detectorOptions: {
      http_auth_header: {
        customHeaders: [/X-Special-Auth\s*:\s*(\S+)/],
      },
    },
  });

  expect(customRedactor.redact("X-Special-Auth: my-token-here")).toBe(
    "X-Special-Auth: [HTTP_AUTH_HEADER]",
  );
});

test("custom headers do not break built-in header detection", () => {
  const customRedactor = createRedactor({
    rules: {
      ipv4: "off",
      ipv6: "off",
      mac_address: "off",
      url_with_auth: "off",
      jwt_token: "off",
      url_query_key: "off",
      http_auth_header: { action: "redact" },
    },
    detectorOptions: {
      http_auth_header: {
        customHeaders: ["My-Custom-Auth"],
      },
    },
  });

  expect(customRedactor.redact("My-Custom-Auth: custom-secret-123")).toBe(
    "My-Custom-Auth: [HTTP_AUTH_HEADER]",
  );

  expect(customRedactor.redact("Authorization: Basic dXNlcjpwYXNz")).toBe(
    "Authorization: Basic [HTTP_AUTH_HEADER]",
  );

  expect(customRedactor.redact("Api-Key: sk-1234567890abcdef")).toBe(
    "Api-Key: [HTTP_AUTH_HEADER]",
  );

  expect(customRedactor.redact("X-Api-Key: abc123def456")).toBe(
    "X-Api-Key: [HTTP_AUTH_HEADER]",
  );
});

test("mixed string and RegExp custom headers work together with built-ins", () => {
  const customRedactor = createRedactor({
    rules: {
      ipv4: "off",
      ipv6: "off",
      mac_address: "off",
      url_with_auth: "off",
      jwt_token: "off",
      url_query_key: "off",
      http_auth_header: { action: "redact" },
    },
    detectorOptions: {
      http_auth_header: {
        customHeaders: ["My-Custom-Auth", /X-Special-Auth\s*:\s*(\S+)/],
      },
    },
  });

  expect(customRedactor.redact("My-Custom-Auth: secret1")).toBe(
    "My-Custom-Auth: [HTTP_AUTH_HEADER]",
  );

  expect(customRedactor.redact("X-Special-Auth: secret2")).toBe(
    "X-Special-Auth: [HTTP_AUTH_HEADER]",
  );

  expect(customRedactor.redact("Authorization: Bearer token123")).toBe(
    "Authorization: Bearer [HTTP_AUTH_HEADER]",
  );
});
