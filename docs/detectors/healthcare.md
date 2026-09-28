# Healthcare Detectors

## us_npi

Detects US National Provider Identifier (10 digits with Luhn check using prefix
80840).

```ts
const redactor = createRedactor({
  rules: { us_npi: { action: "redact" } },
});

redactor.redact("NPI: 1234567893");
// "NPI: [US_NPI_1]"
```

- **ID**: `us_npi`
- **Entity type**: `us_npi`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Luhn checksum with 80840 prefix

## us_dea

Detects US DEA numbers (2 letters + 7 digits with checksum validation).

```ts
const redactor = createRedactor({
  rules: { us_dea: { action: "redact" } },
});

redactor.redact("DEA: AB1234563");
// "DEA: [US_DEA_1]"
```

- **ID**: `us_dea`
- **Entity type**: `us_dea`
- **Context required**: Yes (labels: DEA, Drug Enforcement, Controlled
  Substance)
- **Stream supported**: Yes
- **Validation**: 2-letter prefix + 7 digits with checksum

## medical_record_number

Detects medical record numbers with context labels. Requires nearby labels like
"MRN", "Medical Record", or "Medical Record Number".

```ts
const redactor = createRedactor({
  rules: { medical_record_number: { action: "redact" } },
});

redactor.redact("MRN: 12345678");
// "MRN: [MEDICAL_RECORD_NUMBER_1]"
```

- **ID**: `medical_record_number`
- **Entity type**: `medical_record_number`
- **Context required**: Yes (labels: MRN, Medical Record, Medical Record Number)
- **Stream supported**: Yes
- **Validation**: Context label presence

## clinical_trial_id

Detects clinical trial identifiers such as participant IDs, subject IDs,
protocol numbers, and study numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { clinical_trial_id: { action: "redact" } },
});

redactor.redact("Trial ID: NCT12345678");
// "Trial ID: [CLINICAL_TRIAL_ID_1]"
```

- **ID**: `clinical_trial_id`
- **Entity type**: `clinical_trial_id`
- **Context required**: Yes (labels: Trial, Study, Protocol, Research, Clinical,
  Participant, Subject)
- **Stream supported**: Yes (maxMatchLength: 25)
- **Validation**: Context label presence

## medical_device_id

Detects medical device identifiers including implant serial numbers, pacemaker
IDs, and defibrillator IDs. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { medical_device_id: { action: "redact" } },
});

redactor.redact("Device Serial: IMPL12345678");
// "Device Serial: [MEDICAL_DEVICE_ID_1]"
```

- **ID**: `medical_device_id`
- **Entity type**: `medical_device_id`
- **Context required**: Yes (labels: Device, Implant, Pacemaker, Defibrillator,
  Serial, Medical)
- **Stream supported**: Yes (maxMatchLength: 35)
- **Validation**: Context label presence

## medical_code

Detects medical codes including ICD-10 diagnosis codes and CPT procedure codes.
Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { medical_code: { action: "redact" } },
});

redactor.redact("Diagnosis: J45.909");
// "Diagnosis: [MEDICAL_CODE_1]"
```

- **ID**: `medical_code`
- **Entity type**: `medical_code`
- **Context required**: Yes (labels: Diagnosis, Condition, Disease, Disorder,
  ICD, Code, Procedure, CPT, Billing, Treatment, Service)
- **Stream supported**: Yes (maxMatchLength: 8)
- **Validation**: Context label presence, CPT code range validation (100–99499)

## medical_reference

Detects medical reference numbers such as lab test IDs, sample IDs, prescription
numbers, and vaccine record IDs. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { medical_reference: { action: "redact" } },
});

redactor.redact("Lab ID: LAB123456");
// "Lab ID: [MEDICAL_REFERENCE_1]"
```

- **ID**: `medical_reference`
- **Entity type**: `medical_reference`
- **Context required**: Yes (labels: Lab, Test, Sample, Specimen, Pathology,
  Prescription, RX, Vaccine, Vaccination, Immunization)
- **Stream supported**: Yes (maxMatchLength: 30)
- **Validation**: Context label presence

## genetic_info

Detects genetic information markers including RS numbers (SNP identifiers) and
DNA sequences. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { genetic_info: { action: "redact" } },
});

redactor.redact("Gene: rs123456789");
// "Gene: [GENETIC_INFO_1]"
```

- **ID**: `genetic_info`
- **Entity type**: `genetic_info`
- **Context required**: Yes (labels: Genetic, Gene, SNP, Marker, Genome, DNA,
  Variant, Allele, Sequence, Nucleotide)
- **Stream supported**: Yes (maxMatchLength: 100)
- **Validation**: Context label presence

## health_insurance_id

Detects health insurance IDs including claim numbers, health plan IDs,
beneficiary IDs, and member IDs. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { health_insurance_id: { action: "redact" } },
});

redactor.redact("Claim No: CLM12345678");
// "Claim No: [HEALTH_INSURANCE_ID_1]"
```

- **ID**: `health_insurance_id`
- **Entity type**: `health_insurance_id`
- **Context required**: Yes (labels: Insurance, Claim, Medical, Health, Policy,
  Plan, Beneficiary, Member)
- **Stream supported**: Yes (maxMatchLength: 30)
- **Validation**: Context label presence
