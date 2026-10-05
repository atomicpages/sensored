import { expect, test } from "bun:test";
import { createRedactor } from "../src";

const redactor = createRedactor({
  rules: {
    ipv4: "off",
    ipv6: "off",
    mac_address: "off",
    url_with_auth: "off",
    medical_record_number: { action: "redact" },
  },
});

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["MRN: 12345678", "MRN: [MEDICAL_RECORD_NUMBER]"],
  ["mrn: 12345678", "mrn: [MEDICAL_RECORD_NUMBER]"],
  [
    "Medical Record Number: 12345678",
    "Medical Record Number: [MEDICAL_RECORD_NUMBER]",
  ],
  ["medical record no: 12345678", "medical record no: [MEDICAL_RECORD_NUMBER]"],
  ["record number: 12345678", "record number: [MEDICAL_RECORD_NUMBER]"],
  ["patient id: 12345678", "patient id: [MEDICAL_RECORD_NUMBER]"],
  ["chart number: 12345678", "chart number: [MEDICAL_RECORD_NUMBER]"],
  ["MRN: AB12345678", "MRN: [MEDICAL_RECORD_NUMBER]"],
  ["MRN: 1234", "MRN: [MEDICAL_RECORD_NUMBER]"],
  ["Patient: MRN 12345678 done", "Patient: MRN [MEDICAL_RECORD_NUMBER] done"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without context", () => {
  expect(redact("12345678")).toBe("12345678");
});

test("does not match with wrong context", () => {
  expect(redact("phone: 12345678")).toBe("phone: 12345678");
});

test("does not match too short", () => {
  expect(redact("MRN: 123")).toBe("MRN: 123");
});

test("does not match inside a larger word", () => {
  expect(redact("foo12345678bar")).toBe("foo12345678bar");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches at start of text", () => {
  expect(redact("MRN 12345678 is here")).toBe(
    "MRN [MEDICAL_RECORD_NUMBER] is here",
  );
});

test("matches at end of text", () => {
  expect(redact("The MRN 12345678")).toBe("The MRN [MEDICAL_RECORD_NUMBER]");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "MRN: 12345678";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("MRN: [MEDICAL_RECORD_NUMBER]");
  expect(twice).toBe(once);
});
