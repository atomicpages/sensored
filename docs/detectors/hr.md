# HR Detectors

## hr_identifier

Detects HR identifiers such as employee IDs, staff numbers, payroll numbers, and
timesheet numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { hr_identifier: { action: "redact" } },
});

redactor.redact("Employee ID: EMP123456");
// "Employee ID: [HR_IDENTIFIER_1]"
```

- **ID**: `hr_identifier`
- **Entity type**: `hr_identifier`
- **Context required**: Yes (labels: Employee ID, EMP-ID, Staff No, Personnel
  ID, Worker ID, Payroll No, PAY ID, Timesheet No, Timecard ID, Time-Entry No)
- **Stream supported**: Yes (maxMatchLength: 25)
- **Validation**: Context label presence

## hr_screening

Detects HR screening IDs such as background check IDs, drug test IDs,
disciplinary action numbers, and incident numbers. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { hr_screening: { action: "redact" } },
});

redactor.redact("Background Check ID: BGC1234567");
// "Background Check ID: [HR_SCREENING_1]"
```

- **ID**: `hr_screening`
- **Entity type**: `hr_screening`
- **Context required**: Yes (labels: Background Check ID, BGC ID, Screening ID,
  Drug Test ID, Urinalysis ID, Disciplinary Action No, Incident No, Warning No,
  Violation No)
- **Stream supported**: Yes (maxMatchLength: 25)
- **Validation**: Context label presence, at least one digit required

## hr_compensation

Detects compensation data including salary amounts and benefit account numbers.
Requires nearby context labels. Uses dual patterns with deduplication — one for
currency amounts and one for alphanumeric account IDs.

```ts
const redactor = createRedactor({
  rules: { hr_compensation: { action: "redact" } },
});

redactor.redact("Salary: $85,000.00");
// "Salary: [HR_COMPENSATION_1]"
```

- **ID**: `hr_compensation`
- **Entity type**: `hr_compensation`
- **Context required**: Yes (labels: Salary, Compensation, Pay, Wage, Earning,
  Benefits Plan No, Insurance Plan ID, Health-Plan No, 401K Account No, 403B No,
  IRA No, Retirement Account No, Pension No)
- **Stream supported**: Yes (maxMatchLength: 30)
- **Validation**: Context label presence, dual pattern matching with
  deduplication

## hr_recruitment

Detects recruitment IDs such as application IDs, candidate IDs, resume IDs,
performance review IDs, and training certification IDs. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { hr_recruitment: { action: "redact" } },
});

redactor.redact("Application ID: APP1234567");
// "Application ID: [HR_RECRUITMENT_1]"
```

- **ID**: `hr_recruitment`
- **Entity type**: `hr_recruitment`
- **Context required**: Yes (labels: Application ID, Candidate ID, Applicant No,
  Application Ref, Resume ID, CV No, Performance ID, Review ID, Appraisal No,
  Evaluation ID, Training ID, Certification ID, Cert No, Recruiter Ref, Agency
  ID)
- **Stream supported**: Yes (maxMatchLength: 25)
- **Validation**: Context label presence, at least one digit required
