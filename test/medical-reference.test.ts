import { expect, test } from "bun:test";
import { medicalReferenceDetector } from "../src/detectors/healthcare/medical-reference";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: medicalReferenceDetector, setting: { action: "redact" } },
]);

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["Pathology Lab ID: ABC123", "Pathology [MEDICAL_REFERENCE]"],
  ["Pathology Test REF: XYZ789", "Pathology [MEDICAL_REFERENCE]"],
  ["Pathology Sample ID: DEF456", "Pathology [MEDICAL_REFERENCE]"],
  ["Pathology Prescription NO: RX123456", "Pathology [MEDICAL_REFERENCE]"],
  ["Pathology RX Number: ABC123456", "Pathology [MEDICAL_REFERENCE]"],
  ["Pathology Vaccine ID: VAC12345", "Pathology [MEDICAL_REFERENCE]"],
  [
    "Pathology Vaccination Record: IMM123456789",
    "Pathology [MEDICAL_REFERENCE]",
  ],
  ["Pathology Immunization NO: VAC987654321", "Pathology [MEDICAL_REFERENCE]"],
  ["Specimen Lab ID: SP123456", "Specimen [MEDICAL_REFERENCE]"],
  ["pathology lab id: abc123", "pathology [MEDICAL_REFERENCE]"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without context", () => {
  expect(redact("Lab ID: ABC123")).toBe("Lab ID: ABC123");
});

test("does not match with wrong context", () => {
  expect(redact("Reference: Lab ID: ABC123")).toBe("Reference: Lab ID: ABC123");
});

test("does not match too short reference", () => {
  expect(redact("Pathology Lab ID: ABC12")).toBe("Pathology Lab ID: ABC12");
});

test("does not match inside a larger word", () => {
  expect(redact("Pathology xLab ID: ABC123")).toBe("Pathology xLab ID: ABC123");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches 6-char reference (minimum)", () => {
  expect(redact("Pathology Lab ID: ABC123")).toBe(
    "Pathology [MEDICAL_REFERENCE]",
  );
});

test("matches 12-char reference for lab (maximum)", () => {
  expect(redact("Pathology Lab ID: ABC123456789")).toBe(
    "Pathology [MEDICAL_REFERENCE]",
  );
});

test("matches 15-char reference for vaccine (maximum)", () => {
  expect(redact("Pathology Vaccine ID: ABC123456789012")).toBe(
    "Pathology [MEDICAL_REFERENCE]",
  );
});

test("matches at start of text", () => {
  expect(redact("Lab ID: ABC123 (Pathology)")).toBe(
    "[MEDICAL_REFERENCE] (Pathology)",
  );
});

// ---------------------------------------------------------------------------
// Adversarial cases
// ---------------------------------------------------------------------------

test("does not match lab reference longer than 12 chars", () => {
  expect(redact("Pathology Lab ID: ABC1234567890")).toBe(
    "Pathology Lab ID: ABC1234567890",
  );
});

test("does not match prescription reference longer than 12 chars", () => {
  expect(redact("Pathology Prescription NO: RX12345678901")).toBe(
    "Pathology Prescription NO: RX12345678901",
  );
});

test("multiple references in same text", () => {
  expect(
    redact("Pathology Lab ID: ABC123 and Pathology RX Number: XYZ789"),
  ).toBe("Pathology [MEDICAL_REFERENCE] and Pathology [MEDICAL_REFERENCE]");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Pathology Lab ID: ABC123";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Pathology [MEDICAL_REFERENCE]");
  expect(twice).toBe(once);
});
