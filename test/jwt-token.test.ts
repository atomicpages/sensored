import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    jwt_token: { action: "redact" },
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
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    "[JWT_TOKEN]",
  ],
  [
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature123",
    "[JWT_TOKEN]",
  ],
  [
    "Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c here",
    "Token: [JWT_TOKEN] here",
  ],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without eyJ prefix", () => {
  expect(redact("abc.eyJzdWIiOiJ0ZXN0In0.signature")).toBe(
    "abc.eyJzdWIiOiJ0ZXN0In0.signature",
  );
});

test("does not match with only two segments", () => {
  expect(redact("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0")).toBe(
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
  );
});

test("does not match inside a larger word", () => {
  expect(
    redact("fooeyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signaturebar"),
  ).toBe("fooeyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signaturebar");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(
    redact("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature is the token"),
  ).toBe("[JWT_TOKEN] is the token");
});

test("matches at end of text", () => {
  expect(
    redact("The token is eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature"),
  ).toBe("The token is [JWT_TOKEN]");
});

test("trailing period is preserved", () => {
  expect(
    redact("Token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature."),
  ).toBe("Token [JWT_TOKEN].");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Token: [JWT_TOKEN]");
  expect(twice).toBe(once);
});

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

test("underscore-adjacent is not matched", () => {
  expect(redact("_eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature")).toBe(
    "_eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature",
  );
  expect(redact("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature_")).toBe(
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature_",
  );
});
