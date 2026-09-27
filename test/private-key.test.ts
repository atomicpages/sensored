import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    private_key: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

const rsaKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyz
MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyz
-----END RSA PRIVATE KEY-----`;

const ecKey = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEI1234567890abcdefghijklmnopqrstuvwxyz
-----END EC PRIVATE KEY-----`;

const openSshKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1234567890abcdefghijklmnopqrstuvwxyz
-----END OPENSSH PRIVATE KEY-----`;

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["rsa", rsaKey],
  ["ec", ecKey],
  ["openssh", openSshKey],
])("detects %s private key", (_label, key) => {
  expect(redact(key)).toBe("[PRIVATE_KEY]");
});

test("detects key in context", () => {
  expect(redact(`Config: ${rsaKey} done`)).toBe("Config: [PRIVATE_KEY] done");
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without END marker", () => {
  const incomplete = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyz`;
  expect(redact(incomplete)).toBe(incomplete);
});

test("does not match without BEGIN marker", () => {
  const incomplete = `MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyz
-----END RSA PRIVATE KEY-----`;
  expect(redact(incomplete)).toBe(incomplete);
});

test("does not match public key", () => {
  const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A1234567890
-----END PUBLIC KEY-----`;
  expect(redact(publicKey)).toBe(publicKey);
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact(`${rsaKey} is the key`)).toBe("[PRIVATE_KEY] is the key");
});

test("matches at end of text", () => {
  expect(redact(`The key is ${rsaKey}`)).toBe("The key is [PRIVATE_KEY]");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = `Key: ${rsaKey}`;
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Key: [PRIVATE_KEY]");
  expect(twice).toBe(once);
});
