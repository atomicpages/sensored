import { expect, test } from "bun:test";
import { medicalDeviceIdDetector } from "../src/detectors/healthcare/medical-device-id";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: medicalDeviceIdDetector, setting: { action: "redact" } },
]);

function redact(text: string): string {
  return redactor.redact(text);
}

// ---------------------------------------------------------------------------
// Positive cases
// ---------------------------------------------------------------------------

test.each([
  ["Medical Device Serial: ABC12345", "Medical [MEDICAL_DEVICE_ID]"],
  ["Medical Device SN: XYZ98765", "Medical [MEDICAL_DEVICE_ID]"],
  ["Medical Implant S/N: DEF12345678", "Medical [MEDICAL_DEVICE_ID]"],
  ["Medical Pacemaker Serial: GHI98765432", "Medical [MEDICAL_DEVICE_ID]"],
  ["Medical Defibrillator SN: JKL12345678", "Medical [MEDICAL_DEVICE_ID]"],
  ["medical device serial: abc12345", "medical [MEDICAL_DEVICE_ID]"],
])("detects %s", (input, expected) => {
  expect(redact(input)).toBe(expected);
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

test("does not match without context", () => {
  expect(redact("Device Serial: ABC12345")).toBe("Device Serial: ABC12345");
});

test("does not match with wrong context", () => {
  expect(redact("Reference: Device Serial: ABC12345")).toBe(
    "Reference: Device Serial: ABC12345",
  );
});

test("does not match too short serial", () => {
  expect(redact("Medical Device Serial: ABC1234")).toBe(
    "Medical Device Serial: ABC1234",
  );
});

test("does not match inside a larger word", () => {
  expect(redact("Medical xDevice Serial: ABC12345")).toBe(
    "Medical xDevice Serial: ABC12345",
  );
});

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

test("matches 8-char serial (minimum)", () => {
  expect(redact("Medical Device Serial: ABC12345")).toBe(
    "Medical [MEDICAL_DEVICE_ID]",
  );
});

test("matches 20-char serial (maximum)", () => {
  expect(redact("Medical Device Serial: ABCDEFGHIJ1234567890")).toBe(
    "Medical [MEDICAL_DEVICE_ID]",
  );
});

test("matches at start of text", () => {
  expect(redact("Device Serial: ABC12345 (Medical)")).toBe(
    "[MEDICAL_DEVICE_ID] (Medical)",
  );
});

// ---------------------------------------------------------------------------
// Adversarial cases
// ---------------------------------------------------------------------------

test("does not match serial longer than 20 chars", () => {
  expect(redact("Medical Device Serial: ABCDEFGHIJ12345678901")).toBe(
    "Medical Device Serial: ABCDEFGHIJ12345678901",
  );
});

test("does not match without serial label", () => {
  expect(redact("Medical Device: ABC12345")).toBe("Medical Device: ABC12345");
});

test("multiple serials in same text", () => {
  expect(
    redact("Medical Device Serial: ABC12345 and Medical Implant SN: XYZ98765"),
  ).toBe("Medical [MEDICAL_DEVICE_ID] and Medical [MEDICAL_DEVICE_ID]");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("redacted output is idempotent", () => {
  const original = "Medical Device Serial: ABC12345";
  const once = redact(original);
  const twice = redact(once);
  expect(once).toBe("Medical [MEDICAL_DEVICE_ID]");
  expect(twice).toBe(once);
});
