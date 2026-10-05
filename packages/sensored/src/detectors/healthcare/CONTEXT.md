# Healthcare detectors

All built-in healthcare detectors live under `detectors/healthcare/` and extend
the `Detector` base class directly. Each is exported as a singleton and
registered in `detectors/registry.ts`.

```
healthcare/
  us-npi.ts                    UsNpiDetector — US National Provider Identifier
  us-dea.ts                    UsDeaDetector — US DEA registration number
  medical-record-number.ts     MedicalRecordNumberDetector — context-labeled MRN
  medical-code.ts              MedicalCodeDetector — ICD-10 / CPT medical codes
  health-insurance-id.ts       HealthInsuranceIdDetector — health insurance member/claim IDs
  clinical-trial-id.ts         ClinicalTrialIdDetector — clinical trial participant/protocol IDs
  medical-device-id.ts         MedicalDeviceIdDetector — medical device serial numbers
  genetic-info.ts              GeneticInfoDetector — genetic markers (rs IDs, DNA sequences)
  medical-reference.ts         MedicalReferenceDetector — lab/test/prescription/vaccine references
```

### us_npi

Detects US National Provider Identifier (NPI): 10 digits validated via Luhn
checksum with constant prefix `80840` (shared `npiLuhnValid` from
`checksum.ts`). Context-optional (checksum is sufficient). `maxMatchLength: 10`.
Exported as a singleton.

### us_dea

Detects US Drug Enforcement Administration registration number: 2 letters
(first letter = registrant type, second letter = registrant subtype) + 7
digits. Last digit is a checksum: sum of first 6 digits mod 10 must equal the
7th digit. Context-optional. `maxMatchLength: 9`. Exported as a singleton.

### medical_record_number

Detects medical record numbers labeled by surrounding context (e.g., `MRN:
12345678`, `Medical Record Number: ABC123456`). Matches optional 1-2 letter
prefix + 4-16 digits. Context-required (labels: MRN, Medical Record Number,
Record Number, Patient ID, Chart Number). `maxMatchLength: 18`. Exported as a
singleton.

### medical_code

Detects ICD-10 diagnosis codes (letter A–Z excluding U + 2 digits + optional
1–2 decimal digits) and CPT procedure codes (5 digits validated 100–99499).
Context-required (labels: Diagnosis, Condition, Disease, Disorder, ICD, Code,
Procedure, CPT, Billing, Treatment, Service). `maxMatchLength: 8`. Exported
as a singleton.

### health_insurance_id

Detects health insurance member IDs and claim references labeled by pattern
prefixes (CLAIM, CLM, HEALTH PLAN, BENEFICIARY, MEMBER) followed by optional
NO/NUM/REF/ID and 8–16 alphanumeric chars. Context-required (labels: Insurance,
Claim, Medical, Health, Policy, Plan, Beneficiary, Member). Since pattern
includes label prefixes, surrounding context must provide an additional label
not consumed by the match. `maxMatchLength: 30`. Exported as a singleton.

### clinical_trial_id

Detects clinical trial participant IDs (PARTICIPANT/SUBJECT/TRIAL + 1–2
letters + 4–6 digits) and protocol/study IDs (PROTOCOL/STUDY + 6–15
alphanumeric chars). Context-required (labels: Trial, Study, Protocol,
Research, Clinical, Participant, Subject). Since pattern includes label
prefixes, surrounding context must provide an additional label not consumed by
the match. `maxMatchLength: 25`. Exported as a singleton.

### medical_device_id

Detects medical device serial numbers labeled by pattern prefixes (DEVICE,
IMPLANT, PACEMAKER, DEFIBRILLATOR) + SERIAL/SN/S/N + 8–20 alphanumeric chars.
Context-required (labels: Device, Implant, Pacemaker, Defibrillator, Serial,
Medical). Since pattern includes label prefixes, surrounding context must
provide an additional label not consumed by the match. `maxMatchLength: 35`.
Exported as a singleton.

### genetic_info

Detects genetic markers: SNP rs IDs (`rs` + 6–10 digits) and DNA sequences
(20+ nucleotide chars A/T/C/G). Context-required (labels: Genetic, Gene, SNP,
Marker, Genome, DNA, Variant, Allele, Sequence, Nucleotide). Pattern matches
only the rs ID or DNA sequence, not the label. `maxMatchLength: 100`.
Exported as a singleton.

### medical_reference

Detects medical reference IDs labeled by pattern prefixes (LAB, TEST, SAMPLE,
RX, PRESC(RIPTION)?, SCRIPT, VACCINE, VACCINATION, IMMUNIZATION) + optional
ID/NUM/REF/NO/RECORD + 6–15 alphanumeric chars. Context-required (labels: Lab,
Test, Sample, Specimen, Pathology, Prescription, RX, Vaccine, Vaccination,
Immunization). Since pattern includes label prefixes, surrounding context must
provide an additional label not consumed by the match. `maxMatchLength: 30`.
Exported as a singleton.
