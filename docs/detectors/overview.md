# Detector Overview

sensored includes 129 built-in detectors across 13 domains. Each detector
identifies a specific type of sensitive data and can be used with any
transformation action.

## All detectors

| Domain            | Detector ID             | Context Required | Stream Support |
| ----------------- | ----------------------- | ---------------- | -------------- |
| **Contact**       | `address`               | Yes              | Yes            |
|                   | `email`                 | No               | Yes            |
|                   | `phone`                 | No               | Yes            |
|                   | `postal_code`           | No               | Yes            |
| **Crypto**        | `crypto_address`        | No               | Yes            |
|                   | `crypto_tx_hash`        | Yes              | Yes            |
| **Cloud Keys**    | `aws_access_key`        | No               | Yes            |
|                   | `google_api_key`        | No               | Yes            |
|                   | `slack_token`           | No               | Yes            |
|                   | `stripe_api_key`        | No               | Yes            |
| **Financial**     | `card_data`             | Yes              | Yes            |
|                   | `eu_vat`                | No               | Yes            |
|                   | `financial_reference`   | Yes              | Yes            |
|                   | `iban`                  | No               | Yes            |
|                   | `investment_account`    | Yes              | Yes            |
|                   | `payment_card`          | No               | Yes            |
|                   | `payment_gateway_id`    | Yes              | Yes            |
|                   | `swift_bic`             | Yes              | Yes            |
|                   | `uk_bank_account`       | Yes              | Yes            |
|                   | `uk_sort_code`          | Yes              | Yes            |
|                   | `us_routing`            | Yes              | Yes            |
| **Healthcare**    | `clinical_trial_id`     | Yes              | Yes            |
|                   | `genetic_info`          | Yes              | Yes            |
|                   | `health_insurance_id`   | Yes              | Yes            |
|                   | `medical_code`          | Yes              | Yes            |
|                   | `medical_device_id`     | Yes              | Yes            |
|                   | `medical_record_number` | Yes              | Yes            |
|                   | `medical_reference`     | Yes              | Yes            |
|                   | `us_dea`                | Yes              | Yes            |
|                   | `us_npi`                | No               | Yes            |
| **HR**            | `hr_compensation`       | Yes              | Yes            |
|                   | `hr_identifier`         | Yes              | Yes            |
|                   | `hr_recruitment`        | Yes              | Yes            |
|                   | `hr_screening`          | Yes              | Yes            |
| **Identity**      | `digital_identity`      | Yes              | Yes            |
|                   | `drivers_license`       | Yes              | Yes            |
|                   | `imei`                  | No               | Yes            |
|                   | `imsi`                  | Yes              | Yes            |
|                   | `license_plate`         | Yes              | Yes            |
|                   | `passport`              | Yes              | Yes            |
|                   | `vin`                   | No               | Yes            |
| **Legal**         | `legal_case`            | Yes              | Yes            |
|                   | `legal_license`         | Yes              | Yes            |
|                   | `legal_reference`       | Yes              | Yes            |
| **National ID**   | `ar_cuit`               | Yes              | Yes            |
|                   | `ar_dni`                | Yes              | Yes            |
|                   | `au_tfn`                | No               | Yes            |
|                   | `bg_egn`                | Yes              | Yes            |
|                   | `bh_cpr`                | Yes              | Yes            |
|                   | `ca_sin`                | No               | Yes            |
|                   | `cl_rut`                | Yes              | Yes            |
|                   | `co_cedula`             | Yes              | Yes            |
|                   | `co_nit`                | Yes              | Yes            |
|                   | `cz_id`                 | Yes              | Yes            |
|                   | `de_id`                 | Yes              | Yes            |
|                   | `ec_cedula`             | Yes              | Yes            |
|                   | `eg_id`                 | Yes              | Yes            |
|                   | `es_dni`                | Yes              | Yes            |
|                   | `fj_id`                 | Yes              | Yes            |
|                   | `fr_insee`              | Yes              | Yes            |
|                   | `gh_card`               | Yes              | Yes            |
|                   | `hu_id`                 | Yes              | Yes            |
|                   | `hu_tax_id`             | Yes              | Yes            |
|                   | `id_nik`                | Yes              | Yes            |
|                   | `id_npwp`               | Yes              | Yes            |
|                   | `il_id`                 | Yes              | Yes            |
|                   | `it_codice_fiscale`     | Yes              | Yes            |
|                   | `jo_id`                 | Yes              | Yes            |
|                   | `jp_my_number`          | No               | Yes            |
|                   | `ke_id`                 | Yes              | Yes            |
|                   | `ke_kra_pin`            | Yes              | Yes            |
|                   | `kg_pin`                | Yes              | Yes            |
|                   | `kw_id`                 | Yes              | Yes            |
|                   | `kz_iin`                | Yes              | Yes            |
|                   | `lb_id`                 | Yes              | Yes            |
|                   | `ma_id`                 | Yes              | Yes            |
|                   | `mm_nrc`                | Yes              | Yes            |
|                   | `my_ic`                 | Yes              | Yes            |
|                   | `ng_bvn`                | Yes              | Yes            |
|                   | `ng_nin`                | Yes              | Yes            |
|                   | `nl_bsn`                | Yes              | Yes            |
|                   | `nz_driver_license`     | Yes              | Yes            |
|                   | `nz_ird`                | No               | Yes            |
|                   | `nz_ird_extra`          | Yes              | Yes            |
|                   | `nz_passport`           | Yes              | Yes            |
|                   | `om_id`                 | Yes              | Yes            |
|                   | `pe_dni`                | Yes              | Yes            |
|                   | `pe_ruc`                | Yes              | Yes            |
|                   | `ph_umid`               | Yes              | Yes            |
|                   | `pl_pesel`              | Yes              | Yes            |
|                   | `png_id`                | Yes              | Yes            |
|                   | `qa_id`                 | Yes              | Yes            |
|                   | `ro_cnp`                | Yes              | Yes            |
|                   | `rs_jmbg`               | Yes              | Yes            |
|                   | `ru_passport`           | Yes              | Yes            |
|                   | `ru_snils`              | Yes              | Yes            |
|                   | `sa_id`                 | Yes              | Yes            |
|                   | `us_ssn`                | Yes              | Yes            |
|                   | `th_id`                 | Yes              | Yes            |
|                   | `tj_id`                 | Yes              | Yes            |
|                   | `tm_passport`           | Yes              | Yes            |
|                   | `to_id`                 | Yes              | Yes            |
|                   | `tr_id`                 | Yes              | Yes            |
|                   | `ua_inn`                | Yes              | Yes            |
|                   | `ua_passport`           | Yes              | Yes            |
|                   | `uae_id`                | Yes              | Yes            |
|                   | `uk_nhs`                | Yes              | Yes            |
|                   | `uk_nino`               | No               | Yes            |
|                   | `us_ein`                | Yes              | Yes            |
|                   | `us_itin`               | No               | Yes            |
|                   | `uy_cedula`             | Yes              | Yes            |
|                   | `uz_passport`           | Yes              | Yes            |
|                   | `uz_stir`               | Yes              | Yes            |
|                   | `ve_cedula`             | Yes              | Yes            |
|                   | `ve_rif`                | Yes              | Yes            |
|                   | `vn_cccd`               | Yes              | Yes            |
|                   | `ws_id`                 | Yes              | Yes            |
|                   | `za_id`                 | Yes              | Yes            |
| **Network**       | `ipv4`                  | No               | Yes            |
|                   | `ipv6`                  | No               | Yes            |
|                   | `mac_address`           | No               | Yes            |
|                   | `url_with_auth`         | No               | Yes            |
| **Person**        | `person_name`           | No               | Yes            |
|                   | `person_name_lite`      | No               | Yes            |
| **Tokens & Keys** | `generic_api_key`       | Yes              | Yes            |
|                   | `github_token`          | No               | Yes            |
|                   | `jwt_token`             | No               | Yes            |
|                   | `private_key`           | No               | Yes            |
| **Logistics**     | `tracking_number`       | Yes              | Yes            |

## Context requirements

Some detectors require nearby context labels to confirm a match. For example,
`us_ssn` looks for labels like "SSN" or "Social Security Number" near the
candidate number. This reduces false positives from arbitrary 9-digit numbers.

You can discover context requirements programmatically via `listDetectors()` or
`redactor.describe()`. Each returns `DetectorDescription` objects with an
optional `contextHint` field containing the labels, position, and window. See
[LLM Steering](../guide/llm-steering) for details.

Context-required detectors:

- `address` — Labels: Address, Street, Ave, Boulevard, Road, etc.
- `card_data` — Labels: Card, PAN, CVV, CVC, Card Number
- `clinical_trial_id` — Labels: NCT, Clinical Trial, Study
- `crypto_tx_hash` — Labels: Transaction, Tx, Hash, Blockchain
- `digital_identity` — Labels: Username, User ID, Handle, Account
- `drivers_license` — Labels: Driver's License, DL, License No., Driving Licence
- `financial_reference` — Labels: Reference, Ref, Transaction ID
- `generic_api_key` — Labels: API key, API secret, access token, etc.
- `gh_card` — Labels: Ghana Card, National ID
- `hr_compensation` — Labels: Salary, Bonus, Compensation, Pay
- `hr_identifier` — Labels: Employee ID, Staff ID, Personnel
- `hr_recruitment` — Labels: Application, Candidate, Requisition
- `hr_screening` — Labels: Background, Screening, Check
- `investment_account` — Labels: Account, Investment, Portfolio
- `legal_case` — Labels: Case, Docket, No., vs.
- `legal_license` — Labels: Bar, License, Attorney
- `legal_reference` — Labels: Statute, CFR, USC, Section
- `license_plate` — Labels: License Plate, Plate, Registration
- `medical_code` — Labels: ICD-10, CPT, HCPCS, Diagnosis Code
- `medical_device_id` — Labels: UDI, Device ID, Medical Device
- `medical_record_number` — Labels: MRN, Medical Record, Medical Record Number
- `medical_reference` — Labels: Reference, DOI, PubMed
- `passport` — Labels: Passport, Passport No., Passport Number
- `payment_gateway_id` — Labels: Gateway, Merchant, Payment ID
- `swift_bic` — Labels: SWIFT, BIC, Bank Code
- `uk_bank_account` — Labels: Account Number, Bank Account
- `uk_nhs` — Labels: NHS, Health Service
- `uk_sort_code` — Labels: Sort Code, Bank Code
- `us_dea` — Labels: DEA, DEA Number
- `us_ein` — Labels: EIN, Employer ID, Tax ID
- `us_routing` — Labels: Routing, ABA, Transit
- `us_ssn` — Labels: SSN, Social Security Number, Social Security No.
- `tracking_number` — Labels: tracking, tracking number, shipment, waybill,
  parcel
- All 56 new national ID detectors — Labels vary per country (see individual
  detector pages)

## Detection mechanisms

Detectors use three complementary mechanisms:

1. **Regex candidate discovery** — Pattern matching finds potential matches
2. **Deterministic validators** — Checksums (Luhn, mod-97, mod-11, mod-23),
   length validation, and format rules filter out false positives
3. **Context rules** — Nearby labels confirm or reject candidates

## Overlap resolution

When matches from different detectors overlap, they form transitive overlap
groups. The highest-precedence action in the group wins:

**remove > redact > format-preserve > token-replace > mask**

Adjacent (non-overlapping) matches remain separate groups.
