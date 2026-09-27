import { expect, test } from "bun:test";
import { medicalCodeDetector } from "../src/detectors/healthcare/medical-code";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: medicalCodeDetector, setting: { action: "redact" } },
]);

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["Diagnosis: E11.9", "Diagnosis: [MEDICAL_CODE]"],
  ["Diagnosis: E11", "Diagnosis: [MEDICAL_CODE]"],
  ["Diagnosis: A00", "Diagnosis: [MEDICAL_CODE]"],
  ["ICD Code: S72.0", "ICD Code: [MEDICAL_CODE]"],
  ["Condition: J45.90", "Condition: [MEDICAL_CODE]"],
  ["Disease: M54.5", "Disease: [MEDICAL_CODE]"],
  ["CPT: 99213", "CPT: [MEDICAL_CODE]"],
  ["Procedure: 00100", "Procedure: [MEDICAL_CODE]"],
  ["Billing: 99499", "Billing: [MEDICAL_CODE]"],
  ["Treatment: 29881", "Treatment: [MEDICAL_CODE]"],
  ["Service: 99203", "Service: [MEDICAL_CODE]"],
  ["diagnosis: e11.9", "diagnosis: [MEDICAL_CODE]"],
  ["icd: S72.01", "icd: [MEDICAL_CODE]"],
  ["E11.9 (Diagnosis)", "[MEDICAL_CODE] (Diagnosis)"],
  ["99213 (CPT)", "[MEDICAL_CODE] (CPT)"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without context", () => {
  expect(redact("E11.9")).toBe("E11.9");
  expect(redact("99213")).toBe("99213");
});

test("does not match with wrong context", () => {
  expect(redact("Reference: E11.9")).toBe("Reference: E11.9");
  expect(redact("Reference: 99213")).toBe("Reference: 99213");
});

test("does not match with non-adjacent context", () => {
  expect(redact("E11.9 is the diagnosis")).toBe("E11.9 is the diagnosis");
  expect(redact("The diagnosis is E11.9")).toBe("The diagnosis is E11.9");
});

test("does not match CPT out of range", () => {
  expect(redact("CPT: 00099")).toBe("CPT: 00099");
  expect(redact("CPT: 99500")).toBe("CPT: 99500");
});

test("does not match inside a larger word", () => {
  expect(redact("fooE11.9bar")).toBe("fooE11.9bar");
  expect(redact("foo99213bar")).toBe("foo99213bar");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches CPT at range boundaries", () => {
  expect(redact("CPT: 00100")).toBe("CPT: [MEDICAL_CODE]");
  expect(redact("CPT: 99499")).toBe("CPT: [MEDICAL_CODE]");
});

test("matches ICD-10 without decimal", () => {
  expect(redact("Diagnosis: E11")).toBe("Diagnosis: [MEDICAL_CODE]");
});

test("matches ICD-10 with one decimal digit", () => {
  expect(redact("Diagnosis: E11.9")).toBe("Diagnosis: [MEDICAL_CODE]");
});

test("matches ICD-10 with two decimal digits", () => {
  expect(redact("Diagnosis: S72.01")).toBe("Diagnosis: [MEDICAL_CODE]");
});

test("does not match ICD-10 with three decimal digits", () => {
  expect(redact("Diagnosis: E11.999")).toBe("Diagnosis: E11.999");
});

// ---------------------------------------------------------------------------
// Adversarial cases
// ---------------------------------------------------------------------------

test("does not match 6-digit number as CPT", () => {
  expect(redact("CPT: 992130")).toBe("CPT: 992130");
});

test("does not match 4-digit number as CPT", () => {
  expect(redact("CPT: 9921")).toBe("CPT: 9921");
});

test("does not match U in ICD-10 first position", () => {
  expect(redact("Diagnosis: U00")).toBe("Diagnosis: U00");
});

test("multiple codes in same text", () => {
  expect(redact("Diagnosis: E11.9, CPT: 99213")).toBe(
    "Diagnosis: [MEDICAL_CODE], CPT: [MEDICAL_CODE]",
  );
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Diagnosis: E11.9";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Diagnosis: [MEDICAL_CODE]");
  expect(twice).toBe(once);
});
