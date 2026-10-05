import { expect, test } from "bun:test";
import { healthInsuranceIdDetector } from "../src/detectors/healthcare/health-insurance-id";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: healthInsuranceIdDetector, setting: { action: "redact" } },
]);

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["Insurance Claim NO: ABC12345", "Insurance [HEALTH_INSURANCE_ID]"],
  ["Medical CLM REF: XYZ98765", "Medical [HEALTH_INSURANCE_ID]"],
  ["Insurance Health Plan ID: MEMBER12345", "Insurance [HEALTH_INSURANCE_ID]"],
  ["Policy Beneficiary ID: BENEF98765", "Policy [HEALTH_INSURANCE_ID]"],
  ["Insurance Claim ID: ABC12345DEF", "Insurance [HEALTH_INSURANCE_ID]"],
  ["Insurance Member NO: ABC12345", "Insurance [HEALTH_INSURANCE_ID]"],
  ["insurance claim no: abc12345", "insurance [HEALTH_INSURANCE_ID]"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without context", () => {
  expect(redact("Claim NO: ABC12345")).toBe("Claim NO: ABC12345");
});

test("does not match with wrong context", () => {
  expect(redact("Reference: Claim NO: ABC12345")).toBe(
    "Reference: Claim NO: ABC12345",
  );
});

test("does not match too short ID", () => {
  expect(redact("Insurance Claim NO: ABC1234")).toBe(
    "Insurance Claim NO: ABC1234",
  );
});

test("does not match inside a larger word", () => {
  expect(redact("Insurance xClaim NO: ABC12345")).toBe(
    "Insurance xClaim NO: ABC12345",
  );
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches 8-char ID (minimum)", () => {
  expect(redact("Insurance Claim NO: ABC12345")).toBe(
    "Insurance [HEALTH_INSURANCE_ID]",
  );
});

test("matches claim without suffix label", () => {
  expect(redact("Insurance Claim ABC12345")).toBe(
    "Insurance [HEALTH_INSURANCE_ID]",
  );
});

test("matches at start of text", () => {
  expect(redact("Claim NO: ABC12345 (Insurance)")).toBe(
    "[HEALTH_INSURANCE_ID] (Insurance)",
  );
});

// ---------------------------------------------------------------------------
// Adversarial cases
// ---------------------------------------------------------------------------

test("does not match ID longer than 16 chars for claim pattern", () => {
  expect(redact("Insurance Claim NO: ABC12345DEFGHIJKL")).toBe(
    "Insurance Claim NO: ABC12345DEFGHIJKL",
  );
});

test("does not match ID longer than 15 chars for member pattern", () => {
  expect(redact("Insurance Health Plan ID: ABC12345DEFGHIJKL")).toBe(
    "Insurance Health Plan ID: ABC12345DEFGHIJKL",
  );
});

test("multiple IDs in same text", () => {
  expect(
    redact("Insurance Claim NO: ABC12345 and Policy Member ID: XYZ98765"),
  ).toBe("Insurance [HEALTH_INSURANCE_ID] and Policy [HEALTH_INSURANCE_ID]");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Insurance Claim NO: ABC12345";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Insurance [HEALTH_INSURANCE_ID]");
  expect(twice).toBe(once);
});
