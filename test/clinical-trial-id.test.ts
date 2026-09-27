import { expect, test } from "bun:test";
import { clinicalTrialIdDetector } from "../src/detectors/healthcare/clinical-trial-id";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: clinicalTrialIdDetector, setting: { action: "redact" } },
]);

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["Clinical Trial ID: AB1234", "Clinical [CLINICAL_TRIAL_ID]"],
  ["Research Subject NO: CD5678", "Research [CLINICAL_TRIAL_ID]"],
  ["Clinical Participant ID: EF9012", "Clinical [CLINICAL_TRIAL_ID]"],
  ["Research Protocol ABC12345", "Research [CLINICAL_TRIAL_ID]"],
  ["Clinical Study NO: XYZ987654", "Clinical [CLINICAL_TRIAL_ID]"],
  ["Trial Protocol NO: XYZ987654", "Trial [CLINICAL_TRIAL_ID]"],
  ["Clinical Study ID: PROTOCOL12345", "Clinical [CLINICAL_TRIAL_ID]"],
  ["clinical trial id: ab1234", "clinical [CLINICAL_TRIAL_ID]"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without context", () => {
  expect(redact("Trial ID: AB1234")).toBe("Trial ID: AB1234");
});

test("does not match with wrong context", () => {
  expect(redact("Reference: Trial ID: AB1234")).toBe(
    "Reference: Trial ID: AB1234",
  );
});

test("does not match too short participant ID", () => {
  expect(redact("Clinical Trial ID: AB123")).toBe("Clinical Trial ID: AB123");
});

test("does not match inside a larger word", () => {
  expect(redact("Clinical xTrial ID: AB1234")).toBe(
    "Clinical xTrial ID: AB1234",
  );
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches 4-digit participant ID (minimum)", () => {
  expect(redact("Clinical Trial ID: AB1234")).toBe(
    "Clinical [CLINICAL_TRIAL_ID]",
  );
});

test("matches 6-digit participant ID (maximum)", () => {
  expect(redact("Clinical Trial ID: AB123456")).toBe(
    "Clinical [CLINICAL_TRIAL_ID]",
  );
});

test("matches protocol without suffix label", () => {
  expect(redact("Research Protocol ABC12345")).toBe(
    "Research [CLINICAL_TRIAL_ID]",
  );
});

test("matches at start of text", () => {
  expect(redact("Trial ID: AB1234 (Clinical)")).toBe(
    "[CLINICAL_TRIAL_ID] (Clinical)",
  );
});

// ---------------------------------------------------------------------------
// Adversarial cases
// ---------------------------------------------------------------------------

test("does not match protocol ID longer than 15 chars", () => {
  expect(redact("Research Protocol ABCDEFGHIJKLMNOP1234")).toBe(
    "Research Protocol ABCDEFGHIJKLMNOP1234",
  );
});

test("does not match participant ID with 7 digits", () => {
  expect(redact("Clinical Trial ID: AB1234567")).toBe(
    "Clinical Trial ID: AB1234567",
  );
});

test("multiple IDs in same text", () => {
  expect(
    redact("Clinical Trial ID: AB1234 and Research Protocol: XYZ987654"),
  ).toBe("Clinical [CLINICAL_TRIAL_ID] and Research [CLINICAL_TRIAL_ID]");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Clinical Trial ID: AB1234";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Clinical [CLINICAL_TRIAL_ID]");
  expect(twice).toBe(once);
});
