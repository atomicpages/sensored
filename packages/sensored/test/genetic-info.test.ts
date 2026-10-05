import { expect, test } from "bun:test";
import { geneticInfoDetector } from "../src/detectors/healthcare/genetic-info";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: geneticInfoDetector, setting: { action: "redact" } },
]);

function redact(text: string): string {
  return redactor.redact(text);
}

const dna20 = "ATCGATCGATCGATCGATCG";
const dna25 = "ATCGATCGATCGATCGATCGATCGA";

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["Genetic marker: rs123456", "Genetic marker: [GENETIC_INFO]"],
  ["Gene: rs12345678", "Gene: [GENETIC_INFO]"],
  ["DNA: rs1234567890", "DNA: [GENETIC_INFO]"],
  [`SNP: ${dna20}`, "SNP: [GENETIC_INFO]"],
  [`Genome sequence: ${dna25}`, "Genome sequence: [GENETIC_INFO]"],
  ["Variant: rs123456789", "Variant: [GENETIC_INFO]"],
  ["Allele: rs987654321", "Allele: [GENETIC_INFO]"],
  ["genetic marker: rs123456", "genetic marker: [GENETIC_INFO]"],
  [`dna: ${dna20}`, "dna: [GENETIC_INFO]"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without context", () => {
  expect(redact("rs123456")).toBe("rs123456");
  expect(redact(dna20)).toBe(dna20);
});

test("does not match with wrong context", () => {
  expect(redact("Reference: rs123456")).toBe("Reference: rs123456");
  expect(redact(`Reference: ${dna20}`)).toBe(`Reference: ${dna20}`);
});

test("does not match rs with too few digits", () => {
  expect(redact("Genetic marker: rs12345")).toBe("Genetic marker: rs12345");
});

test("does not match DNA sequence shorter than 20", () => {
  expect(redact("DNA: ATCGATCGATCGATCG")).toBe("DNA: ATCGATCGATCGATCG");
});

test("does not match inside a larger word", () => {
  expect(redact("Genetic marker: xrs123456")).toBe("Genetic marker: xrs123456");
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches rs with 6 digits (minimum)", () => {
  expect(redact("Genetic marker: rs123456")).toBe(
    "Genetic marker: [GENETIC_INFO]",
  );
});

test("matches rs with 10 digits (maximum)", () => {
  expect(redact("Genetic marker: rs1234567890")).toBe(
    "Genetic marker: [GENETIC_INFO]",
  );
});

test("matches exactly 20-char DNA sequence", () => {
  expect(redact(`DNA: ${dna20}`)).toBe("DNA: [GENETIC_INFO]");
});

test("matches at start of text", () => {
  expect(redact("rs123456 (Genetic)")).toBe("[GENETIC_INFO] (Genetic)");
});

// ---------------------------------------------------------------------------
// Adversarial cases
// ---------------------------------------------------------------------------

test("does not match rs with 11 digits", () => {
  expect(redact("Genetic marker: rs12345678901")).toBe(
    "Genetic marker: rs12345678901",
  );
});

test("does not match lowercase rs without context", () => {
  expect(redact("rs123456")).toBe("rs123456");
});

test("multiple genetic markers in same text", () => {
  expect(redact("Genetic marker: rs123456 and Gene: rs789012")).toBe(
    "Genetic marker: [GENETIC_INFO] and Gene: [GENETIC_INFO]",
  );
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Genetic marker: rs123456";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Genetic marker: [GENETIC_INFO]");
  expect(twice).toBe(once);
});
