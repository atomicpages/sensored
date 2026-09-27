# Legal Detectors

## legal_case

Detects legal case numbers. Requires nearby context labels such as "Case",
"Docket", "Court", or "Subpoena".

```ts
const redactor = createRedactor({
  rules: { legal_case: { action: "redact" } },
});

redactor.redact("Case No: CV2024001234");
// "Case No: [LEGAL_CASE_1]"
```

- **ID**: `legal_case`
- **Entity type**: `legal_case`
- **Context required**: Yes (labels: Case, Docket, Court, Subpoena, Summons, Judgment, Order, Decree, Bankruptcy, BK, Probate, Estate, Legal, Lawsuit)
- **Stream supported**: Yes (maxMatchLength: 16)
- **Validation**: Context label presence, at least one digit required

## legal_license

Detects legal license numbers such as bar numbers, attorney IDs, notary
commissions, and court reporter certifications. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { legal_license: { action: "redact" } },
});

redactor.redact("Bar No: BN123456");
// "Bar No: [LEGAL_LICENSE_1]"
```

- **ID**: `legal_license`
- **Entity type**: `legal_license`
- **Context required**: Yes (labels: Bar, Attorney, Lawyer, Notary, Notarial, Court Reporter, CSR, RPR, License, Commission, Legal, Law Firm)
- **Stream supported**: Yes (maxMatchLength: 12)
- **Validation**: Context label presence, at least one digit required

## legal_reference

Detects legal reference numbers such as matter numbers, engagement IDs,
settlement references, and contract numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { legal_reference: { action: "redact" } },
});

redactor.redact("Matter No: MAT123456");
// "Matter No: [LEGAL_REFERENCE_1]"
```

- **ID**: `legal_reference`
- **Entity type**: `legal_reference`
- **Context required**: Yes (labels: Matter, Engagement, Client, Settlement, Agreement, Retainer, NDA, Confidentiality, Non-Disclosure, Contract, CNTR, Legal, Law Firm, Attorney, Counsel)
- **Stream supported**: Yes (maxMatchLength: 15)
- **Validation**: Context label presence, at least one digit required
