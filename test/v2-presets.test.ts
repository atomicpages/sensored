import { expect, test } from "bun:test";
import { createRedactor } from "../src";

// ---------------------------------------------------------------------------
// Compliance presets
// ---------------------------------------------------------------------------

test("healthcare preset includes healthcare detectors", () => {
  const redactor = createRedactor({
    presets: ["healthcare"],
    rules: { phone: "off" },
  });

  expect(redactor.redact("NPI: 1234567893")).toBe("NPI: [US_NPI]");
  expect(redactor.redact("DEA: AB1234561")).toBe("DEA: [US_DEA]");
  expect(redactor.redact("MRN: 12345678")).toBe("MRN: [MEDICAL_RECORD_NUMBER]");
  expect(redactor.redact("NHS: 408123462")).toBe("NHS: [UK_NHS]");
  expect(redactor.redact("test@example.com")).toBe("[EMAIL]");
  expect(redactor.redact("4111111111111111")).toBe("[PAYMENT_CARD]");
});

test("finance preset includes financial detectors", () => {
  const redactor = createRedactor({
    presets: ["finance"],
    rules: { phone: "off" },
  });

  expect(redactor.redact("BIC: DEUTDEFF")).toBe("BIC: [SWIFT_BIC]");
  expect(redactor.redact("sort code: 12-34-56")).toBe(
    "sort code: [UK_SORT_CODE]",
  );
  expect(redactor.redact("Routing: 021000021")).toBe("Routing: [US_ROUTING]");
  expect(redactor.redact("account number: 12345678")).toBe(
    "account number: [UK_BANK_ACCOUNT]",
  );
  expect(redactor.redact("test@example.com")).toBe("[EMAIL]");
});

test("education preset includes education detectors", () => {
  const redactor = createRedactor({ presets: ["education"], rules: {} });

  expect(redactor.redact("test@example.com")).toBe("[EMAIL]");
  expect(redactor.redact("123-45-6789 SSN")).toBe("[US_SSN] SSN");
  expect(redactor.redact("John Smith")).not.toBe("John Smith");
});

test("soc2 preset includes security and PII detectors", () => {
  const redactor = createRedactor({ presets: ["soc2"], rules: {} });

  expect(redactor.redact("ghp_1234567890abcdefghijklmnopqrstuvwxyz1234")).toBe(
    "[GITHUB_TOKEN]",
  );
  expect(redactor.redact("AKIA1234567890ABCDEF")).toBe("[AWS_ACCESS_KEY]");
  expect(redactor.redact("203.0.113.1")).toBe("[IPV4]");
  expect(redactor.redact("test@example.com")).toBe("[EMAIL]");
  expect(redactor.redact("4111111111111111")).toBe("[PAYMENT_CARD]");
});

test("security preset includes only security detectors", () => {
  const redactor = createRedactor({ presets: ["security"], rules: {} });

  expect(redactor.redact("ghp_1234567890abcdefghijklmnopqrstuvwxyz1234")).toBe(
    "[GITHUB_TOKEN]",
  );
  expect(redactor.redact("AKIA1234567890ABCDEF")).toBe("[AWS_ACCESS_KEY]");
  expect(redactor.redact("203.0.113.1")).toBe("[IPV4]");
  // Security preset does NOT include PII
  expect(redactor.redact("test@example.com")).toBe("test@example.com");
});

// ---------------------------------------------------------------------------
// Preset content tests
// ---------------------------------------------------------------------------

test("pii includes national ID and financial detectors", () => {
  const redactor = createRedactor({
    presets: ["pii"],
    rules: {
      phone: "off",
      us_ein: "off",
      ca_sin: "off",
      postal_code: "off",
      au_tfn: "off",
      nz_ird_extra: "off",
    },
  });

  expect(redactor.redact("NHS: 408123462")).toBe("NHS: [UK_NHS]");
  expect(redactor.redact("ITIN: 970-70-1234")).toBe("ITIN: [US_ITIN]");
  expect(redactor.redact("IRD: 136410148")).toBe("IRD: [NZ_IRD]");
  expect(redactor.redact("BIC: DEUTDEFF")).toBe("BIC: [SWIFT_BIC]");
  expect(redactor.redact("sort code: 12-34-56")).toBe(
    "sort code: [UK_SORT_CODE]",
  );
  expect(redactor.redact("Routing: 021000021")).toBe("Routing: [US_ROUTING]");
  expect(redactor.redact("account number: 12345678")).toBe(
    "account number: [UK_BANK_ACCOUNT]",
  );

  // us_ein tested separately to avoid overlap with uk_nhs
  const einRedactor = createRedactor({
    presets: ["pii"],
    rules: { phone: "off", uk_nhs: "off" },
  });
  expect(einRedactor.redact("EIN: 01-2345678")).toBe("EIN: [US_EIN]");
});

test("gdpr includes UK-specific detectors", () => {
  const redactor = createRedactor({
    presets: ["gdpr"],
    rules: { phone: "off" },
  });

  expect(redactor.redact("AB123456C")).toBe("[UK_NINO]");
  expect(redactor.redact("NHS: 408123462")).toBe("NHS: [UK_NHS]");
  expect(redactor.redact("sort code: 12-34-56")).toBe(
    "sort code: [UK_SORT_CODE]",
  );
  expect(redactor.redact("account number: 12345678")).toBe(
    "account number: [UK_BANK_ACCOUNT]",
  );
  expect(redactor.redact("BIC: DEUTDEFF")).toBe("BIC: [SWIFT_BIC]");
});

test("hipaa includes healthcare detectors", () => {
  const redactor = createRedactor({
    presets: ["hipaa"],
    rules: { phone: "off", us_ein: "off", postal_code: "off" },
  });

  expect(redactor.redact("NPI: 1234567893")).toBe("NPI: [US_NPI]");
  expect(redactor.redact("DEA: AB1234561")).toBe("DEA: [US_DEA]");
  expect(redactor.redact("MRN: 12345678")).toBe("MRN: [MEDICAL_RECORD_NUMBER]");
  expect(redactor.redact("NHS: 408123462")).toBe("NHS: [UK_NHS]");
  expect(redactor.redact("ITIN: 970-70-1234")).toBe("ITIN: [US_ITIN]");
});
