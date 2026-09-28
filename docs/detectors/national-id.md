# National ID Detectors

## us_ssn

Detects US Social Security Numbers (9-digit compact or 3-2-4 hyphenated format).
Requires nearby context labels to reduce false positives.

Structural exclusions: area numbers 000, 666, 900–999; group numbers 00; serial
numbers 0000.

```ts
const redactor = createRedactor({
  rules: { us_ssn: { action: "redact" } },
});

redactor.redact("SSN: 123-45-6789");
// "SSN: [US_SSN_1]"
```

- **ID**: `us_ssn`
- **Entity type**: `us_ssn`
- **Context required**: Yes (labels: SSN, Social Security Number, Social
  Security No.)
- **Stream supported**: Yes
- **Validation**: Structural exclusions, context label qualification

## uk_nino

Detects UK National Insurance Numbers (2 prefix letters, 6 digits, 1 suffix
letter in compact or spaced format).

Validates prefix (excludes D/F/I/Q/U/V in first position, O in second) and
suffix (A–D, F, J, H, M, N, P, R, S, T, W, X, Y, Z).

```ts
const redactor = createRedactor({
  rules: { uk_nino: { action: "redact" } },
});

redactor.redact("NINO: AB123456C");
// "NINO: [UK_NINO_1]"
```

- **ID**: `uk_nino`
- **Entity type**: `uk_nino`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Prefix/suffix letter validation

## ca_sin

Detects Canadian Social Insurance Numbers (9 digits, compact or hyphenated
format) with Luhn checksum validation.

```ts
const redactor = createRedactor({
  rules: { ca_sin: { action: "redact" } },
});

redactor.redact("SIN: 123-456-789");
// "SIN: [CA_SIN_1]"
```

- **ID**: `ca_sin`
- **Entity type**: `ca_sin`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Luhn checksum

## au_tfn

Detects Australian Tax File Numbers (8–9 digits, compact or spaced format) with
weighted sum mod 11 validation (weights: 1, 4, 3, 7, 5, 8, 6, 9, 10).

```ts
const redactor = createRedactor({
  rules: { au_tfn: { action: "redact" } },
});

redactor.redact("TFN: 123 456 789");
// "TFN: [AU_TFN_1]"
```

- **ID**: `au_tfn`
- **Entity type**: `au_tfn`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Weighted sum mod 11

## jp_my_number

Detects Japanese My Number (12 digits, compact or spaced format) with weighted
sum mod 11 validation (weights: 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2 for first 11
digits; 12th is the check digit).

```ts
const redactor = createRedactor({
  rules: { jp_my_number: { action: "redact" } },
});

redactor.redact("My Number: 1234 5678 9012");
// "My Number: [JP_MY_NUMBER_1]"
```

- **ID**: `jp_my_number`
- **Entity type**: `jp_my_number`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Weighted sum mod 11

## uk_nhs

Detects UK NHS numbers (10 digits with mod-11 checksum validation).

```ts
const redactor = createRedactor({
  rules: { uk_nhs: { action: "redact" } },
});

redactor.redact("NHS: 1234567890");
// "NHS: [UK_NHS_1]"
```

- **ID**: `uk_nhs`
- **Entity type**: `uk_nhs`
- **Context required**: Yes (labels: NHS, National Health Service)
- **Stream supported**: Yes
- **Validation**: Mod-11 checksum

## us_itin

Detects US Individual Taxpayer Identification Numbers (9XX-7X-XXXX or
9XX-8X-XXXX format) with Luhn validation.

```ts
const redactor = createRedactor({
  rules: { us_itin: { action: "redact" } },
});

redactor.redact("ITIN: 912-70-1234");
// "ITIN: [US_ITIN_1]"
```

- **ID**: `us_itin`
- **Entity type**: `us_itin`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Luhn checksum, format (9XX-7X or 9XX-8X prefix)

## us_ein

Detects US Employer Identification Numbers (XX-XXXXXXX format).

```ts
const redactor = createRedactor({
  rules: { us_ein: { action: "redact" } },
});

redactor.redact("EIN: 12-3456789");
// "EIN: [US_EIN_1]"
```

- **ID**: `us_ein`
- **Entity type**: `us_ein`
- **Context required**: Yes (labels: EIN, Employer ID, Tax ID)
- **Stream supported**: Yes
- **Validation**: Format (XX-XXXXXXX)

## nz_ird

Detects New Zealand Inland Revenue Department numbers (8–9 digits with mod-11
weighted sum validation).

```ts
const redactor = createRedactor({
  rules: { nz_ird: { action: "redact" } },
});

redactor.redact("IRD: 123456789");
// "IRD: [NZ_IRD_1]"
```

- **ID**: `nz_ird`
- **Entity type**: `nz_ird`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Weighted sum mod 11

## de_id

Detects German national identity card numbers (Personalausweis). Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { de_id: { action: "redact" } },
});

redactor.redact("Personalausweis: L01X00T47");
// "Personalausweis: [DE_ID_1]"
```

- **ID**: `de_id`
- **Entity type**: `de_id`
- **Context required**: Yes (labels: Personalausweis, German ID, National ID,
  Identity Card, Ausweis)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: Length (10 or 11 chars)

## fr_insee

Detects French INSEE / NIR numbers (15-digit social security identifiers).
Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { fr_insee: { action: "redact" } },
});

redactor.redact("INSEE: 1234567890123 45");
// "INSEE: [FR_INSEE_1]"
```

- **ID**: `fr_insee`
- **Entity type**: `fr_insee`
- **Context required**: Yes (labels: INSEE, NIR, Numéro de Sécurité Sociale,
  Social Security Number, Numéro INSEE)
- **Stream supported**: Yes (maxMatchLength: 15)
- **Validation**: Mod-97 checksum

## it_codice_fiscale

Detects Italian Codice Fiscale (tax code) numbers. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { it_codice_fiscale: { action: "redact" } },
});

redactor.redact("Codice Fiscale: RSSMRA85M01H501Z");
// "Codice Fiscale: [IT_CODICE_FISCALE_1]"
```

- **ID**: `it_codice_fiscale`
- **Entity type**: `it_codice_fiscale`
- **Context required**: Yes (labels: Codice Fiscale, Fiscal Code, Tax Code,
  Italian ID)
- **Stream supported**: Yes (maxMatchLength: 16)
- **Validation**: Italian Codice Fiscale checksum (odd/even character value
  lookup, control character)

## es_dni

Detects Spanish DNI (Documento Nacional de Identidad) numbers. Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { es_dni: { action: "redact" } },
});

redactor.redact("DNI: 12345678Z");
// "DNI: [ES_DNI_1]"
```

- **ID**: `es_dni`
- **Entity type**: `es_dni`
- **Context required**: Yes (labels: DNI, Documento Nacional de Identidad,
  Spanish ID, National ID)
- **Stream supported**: Yes (maxMatchLength: 9)
- **Validation**: Control letter using mod-23 lookup table
  (TRWAGMYFPDXBNJZSQVHLCKE)

## nl_bsn

Detects Dutch BSN (Burgerservicenummer) citizen service numbers. Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { nl_bsn: { action: "redact" } },
});

redactor.redact("BSN: 123.456.782");
// "BSN: [NL_BSN_1]"
```

- **ID**: `nl_bsn`
- **Entity type**: `nl_bsn`
- **Context required**: Yes (labels: BSN, Burgerservicenummer, Dutch ID, Citizen
  Service Number)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: Mod-11 checksum (weighted sum with weights 9..1)

## pl_pesel

Detects Polish PESEL national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { pl_pesel: { action: "redact" } },
});

redactor.redact("PESEL: 12345678901");
// "PESEL: [PL_PESEL_1]"
```

- **ID**: `pl_pesel`
- **Entity type**: `pl_pesel`
- **Context required**: Yes (labels: PESEL, Polish ID, National ID, Identity
  Number)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: PESEL checksum (weights [1,3,7,9,1,3,7,9,1,3,1], sum mod 10
  = 0)

## za_id

Detects South African national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { za_id: { action: "redact" } },
});

redactor.redact("National ID: 1234567890123");
// "National ID: [ZA_ID_1]"
```

- **ID**: `za_id`
- **Entity type**: `za_id`
- **Context required**: Yes (labels: South Africa, RSA, ZA, National ID,
  Identity, ID Number)
- **Stream supported**: Yes (maxMatchLength: 13)
- **Validation**: 13-digit length, month field (1–12), day field (1–31)

## ng_nin

Detects Nigerian National Identification Numbers (NIN). Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { ng_nin: { action: "redact" } },
});

redactor.redact("NIN: 12345678901");
// "NIN: [NG_NIN_1]"
```

- **ID**: `ng_nin`
- **Entity type**: `ng_nin`
- **Context required**: Yes (labels: Nigeria, NIN, National ID, Identity,
  Nigerian)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: 11-digit format

## ng_bvn

Detects Nigerian Bank Verification Numbers (BVN). Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { ng_bvn: { action: "redact" } },
});

redactor.redact("BVN: 12345678901");
// "BVN: [NG_BVN_1]"
```

- **ID**: `ng_bvn`
- **Entity type**: `ng_bvn`
- **Context required**: Yes (labels: BVN, Bank Verification, Nigeria, Nigerian,
  Banking)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: 11-digit format

## ke_id

Detects Kenyan national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { ke_id: { action: "redact" } },
});

redactor.redact("National ID: 12345678");
// "National ID: [KE_ID_1]"
```

- **ID**: `ke_id`
- **Entity type**: `ke_id`
- **Context required**: Yes (labels: Kenya, Kenyan, National ID, Identity)
- **Stream supported**: Yes (maxMatchLength: 8)
- **Validation**: 7–8 digit format

## ke_kra_pin

Detects Kenyan KRA PIN (taxpayer identification) numbers. Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { ke_kra_pin: { action: "redact" } },
});

redactor.redact("KRA PIN: A123456789B");
// "KRA PIN: [KE_KRA_PIN_1]"
```

- **ID**: `ke_kra_pin`
- **Entity type**: `ke_kra_pin`
- **Context required**: Yes (labels: KRA, Kenya, Revenue, Authority, Tax, PIN,
  Taxpayer)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: Format (A + 9 digits + letter)

## eg_id

Detects Egyptian national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { eg_id: { action: "redact" } },
});

redactor.redact("National ID: 12345678901234");
// "National ID: [EG_ID_1]"
```

- **ID**: `eg_id`
- **Entity type**: `eg_id`
- **Context required**: Yes (labels: Egypt, Egyptian, National ID, Identity)
- **Stream supported**: Yes (maxMatchLength: 14)
- **Validation**: 14-digit length, month field (1–12), day field (1–31)

## gh_card

Detects Ghana Card national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { gh_card: { action: "redact" } },
});

redactor.redact("Ghana Card: GHA-123456789-0");
// "Ghana Card: [GH_CARD_1]"
```

- **ID**: `gh_card`
- **Entity type**: `gh_card`
- **Context required**: Yes (labels: Ghana, Ghanaian, Ghana Card, National ID,
  Identity)
- **Stream supported**: Yes (maxMatchLength: 15)
- **Validation**: Format (GHA + 9 digits + check digit)

## ma_id

Detects Moroccan national ID numbers (CNIE). Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { ma_id: { action: "redact" } },
});

redactor.redact("CNIE: AB123456");
// "CNIE: [MA_ID_1]"
```

- **ID**: `ma_id`
- **Entity type**: `ma_id`
- **Context required**: Yes (labels: Morocco, Moroccan, CNIE, National ID,
  Identity)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: Format (1–2 letters + 6–8 digits, or 8 digits)

## kz_iin

Detects Kazakhstani Individual Identification Numbers (IIN). Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { kz_iin: { action: "redact" } },
});

redactor.redact("IIN: 123456789012");
// "IIN: [KZ_IIN_1]"
```

- **ID**: `kz_iin`
- **Entity type**: `kz_iin`
- **Context required**: Yes (labels: Kazakhstan, Kazakh, IIN, Individual
  Identification, ЖСН)
- **Stream supported**: Yes (maxMatchLength: 12)
- **Validation**: 12-digit length, month field (1–12), day field (1–31)

## uz_passport

Detects Uzbekistan passport numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { uz_passport: { action: "redact" } },
});

redactor.redact("Passport: AB1234567");
// "Passport: [UZ_PASSPORT_1]"
```

- **ID**: `uz_passport`
- **Entity type**: `uz_passport`
- **Context required**: Yes (labels: Uzbek, Uzbekistan, Passport, Pasport)
- **Stream supported**: Yes (maxMatchLength: 9)
- **Validation**: Format (2 letters + 7 digits)

## uz_stir

Detects Uzbekistan STIR (tax identification) numbers. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { uz_stir: { action: "redact" } },
});

redactor.redact("STIR: 123456789");
// "STIR: [UZ_STIR_1]"
```

- **ID**: `uz_stir`
- **Entity type**: `uz_stir`
- **Context required**: Yes (labels: Uzbek, Uzbekistan, STIR, Tax, INN, Soliq)
- **Stream supported**: Yes (maxMatchLength: 9)
- **Validation**: 9-digit format

## kg_pin

Detects Kyrgyzstani Personal Identification Numbers (PIN). Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { kg_pin: { action: "redact" } },
});

redactor.redact("PIN: 12345678901234");
// "PIN: [KG_PIN_1]"
```

- **ID**: `kg_pin`
- **Entity type**: `kg_pin`
- **Context required**: Yes (labels: Kyrgyz, Kyrgyzstan, PIN, Personal ID,
  Личный, Номер)
- **Stream supported**: Yes (maxMatchLength: 14)
- **Validation**: 14-digit format

## tj_id

Detects Tajikistan national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { tj_id: { action: "redact" } },
});

redactor.redact("National ID: 123456789");
// "National ID: [TJ_ID_1]"
```

- **ID**: `tj_id`
- **Entity type**: `tj_id`
- **Context required**: Yes (labels: Tajik, Tajikistan, National ID, Identity)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: 9–10 digit format

## tm_passport

Detects Turkmenistan passport numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { tm_passport: { action: "redact" } },
});

redactor.redact("Passport: A1234567");
// "Passport: [TM_PASSPORT_1]"
```

- **ID**: `tm_passport`
- **Entity type**: `tm_passport`
- **Context required**: Yes (labels: Turkmen, Turkmenistan, Passport, Pasport)
- **Stream supported**: Yes (maxMatchLength: 8)
- **Validation**: Format (1 letter + 7 digits)

## ru_passport

Detects Russian passport numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { ru_passport: { action: "redact" } },
});

redactor.redact("Passport: 1234 567890");
// "Passport: [RU_PASSPORT_1]"
```

- **ID**: `ru_passport`
- **Entity type**: `ru_passport`
- **Context required**: Yes (labels: Russia, Russian, Passport, Паспорт,
  Российский)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: Format (4 digits + 6 digits)

## ru_snils

Detects Russian SNILS (pension insurance) numbers. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { ru_snils: { action: "redact" } },
});

redactor.redact("SNILS: 123-456-789 00");
// "SNILS: [RU_SNILS_1]"
```

- **ID**: `ru_snils`
- **Entity type**: `ru_snils`
- **Context required**: Yes (labels: Russia, Russian, SNILS, СНИЛС, Pension,
  Пенсионный)
- **Stream supported**: Yes (maxMatchLength: 14)
- **Validation**: Format (3-3-3 2 digit groups)

## ua_passport

Detects Ukrainian passport numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { ua_passport: { action: "redact" } },
});

redactor.redact("Passport: AB123456");
// "Passport: [UA_PASSPORT_1]"
```

- **ID**: `ua_passport`
- **Entity type**: `ua_passport`
- **Context required**: Yes (labels: Ukrainian, Passport, Паспорт, Український)
- **Stream supported**: Yes (maxMatchLength: 8)
- **Validation**: Format (2 letters + 6 digits)

## ua_inn

Detects Ukrainian INN (tax identification) numbers. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { ua_inn: { action: "redact" } },
});

redactor.redact("INN: 1234567890");
// "INN: [UA_INN_1]"
```

- **ID**: `ua_inn`
- **Entity type**: `ua_inn`
- **Context required**: Yes (labels: Ukrainian, INN, Tax, Податковий, ІНН)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: 10-digit format

## cz_id

Detects Czech national ID numbers (Rodné číslo). Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { cz_id: { action: "redact" } },
});

redactor.redact("Rodné číslo: 123456/7890");
// "Rodné číslo: [CZ_ID_1]"
```

- **ID**: `cz_id`
- **Entity type**: `cz_id`
- **Context required**: Yes (labels: Czech, Czechia, Republic, Rodné, Číslo,
  National ID)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: 10-digit length, month field (1–12 or 51–62), day field (1–31)

## ro_cnp

Detects Romanian CNP (Cod Numeric Personal) numbers. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { ro_cnp: { action: "redact" } },
});

redactor.redact("CNP: 1234567890123");
// "CNP: [RO_CNP_1]"
```

- **ID**: `ro_cnp`
- **Entity type**: `ro_cnp`
- **Context required**: Yes (labels: Romania, Romanian, CNP, Cod Numeric,
  Personal)
- **Stream supported**: Yes (maxMatchLength: 13)
- **Validation**: 13-digit length, first digit (1–9), month field (1–12), day
  field (1–31)

## hu_id

Detects Hungarian national ID numbers (Személyi igazolvány). Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { hu_id: { action: "redact" } },
});

redactor.redact("Személyi: 123456AB");
// "Személyi: [HU_ID_1]"
```

- **ID**: `hu_id`
- **Entity type**: `hu_id`
- **Context required**: Yes (labels: Hungarian, Magyar, Személyi, Igazolvány,
  Personal ID)
- **Stream supported**: Yes (maxMatchLength: 8)
- **Validation**: Format (6 digits + 2 letters)

## hu_tax_id

Detects Hungarian tax identification numbers (Adóazonosító). Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { hu_tax_id: { action: "redact" } },
});

redactor.redact("Adó: 1234567890");
// "Adó: [HU_TAX_ID_1]"
```

- **ID**: `hu_tax_id`
- **Entity type**: `hu_tax_id`
- **Context required**: Yes (labels: Hungarian, Magyar, Adó, Tax, Adóazonosító)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: 10-digit format

## bg_egn

Detects Bulgarian EGN (Personal Number) numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { bg_egn: { action: "redact" } },
});

redactor.redact("EGN: 1234567890");
// "EGN: [BG_EGN_1]"
```

- **ID**: `bg_egn`
- **Entity type**: `bg_egn`
- **Context required**: Yes (labels: Bulgaria, Bulgarian, EGN, Personal Number,
  Единен)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: 10-digit length, month field (1–12, 21–32, or 41–52), day
  field (1–31)

## rs_jmbg

Detects Serbian JMBG (Unique Master Citizen Number) numbers. Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { rs_jmbg: { action: "redact" } },
});

redactor.redact("JMBG: 1234567890123");
// "JMBG: [RS_JMBG_1]"
```

- **ID**: `rs_jmbg`
- **Entity type**: `rs_jmbg`
- **Context required**: Yes (labels: Serbian, Serbia, JMBG, Jedinstveni,
  Matični, Personal)
- **Stream supported**: Yes (maxMatchLength: 13)
- **Validation**: 13-digit length, day field (1–31), month field (1–12)

## ar_dni

Detects Argentine DNI numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { ar_dni: { action: "redact" } },
});

redactor.redact("DNI: 12345678");
// "DNI: [AR_DNI_1]"
```

- **ID**: `ar_dni`
- **Entity type**: `ar_dni`
- **Context required**: Yes (labels: Argentina, Argentin, DNI, Documento
  Nacional, Identidad)
- **Stream supported**: Yes (maxMatchLength: 8)
- **Validation**: 7–8 digit format

## ar_cuit

Detects Argentine CUIT/CUIL tax identification numbers. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { ar_cuit: { action: "redact" } },
});

redactor.redact("CUIT: 20-12345678-3");
// "CUIT: [AR_CUIT_1]"
```

- **ID**: `ar_cuit`
- **Entity type**: `ar_cuit`
- **Context required**: Yes (labels: Argentina, CUIT, CUIL, Tax, Impuesto,
  Tributario)
- **Stream supported**: Yes (maxMatchLength: 13)
- **Validation**: Format (2 digits + 8 digits + check digit)

## cl_rut

Detects Chilean RUT (Rol Único Tributario) numbers. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { cl_rut: { action: "redact" } },
});

redactor.redact("RUT: 12.345.678-K");
// "RUT: [CL_RUT_1]"
```

- **ID**: `cl_rut`
- **Entity type**: `cl_rut`
- **Context required**: Yes (labels: Chile, Chilean, RUT, Rol Único, Tributario,
  Cédula)
- **Stream supported**: Yes (maxMatchLength: 12)
- **Validation**: Chilean RUT checksum (mod-11, check digit 0–9 or K)

## co_cedula

Detects Colombian Cédula de Ciudadanía numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { co_cedula: { action: "redact" } },
});

redactor.redact("Cédula: 1234567890");
// "Cédula: [CO_CEDULA_1]"
```

- **ID**: `co_cedula`
- **Entity type**: `co_cedula`
- **Context required**: Yes (labels: Colombia, Colombian, Cédula, Cedula,
  Ciudadanía, CC)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: 6–10 digit format

## co_nit

Detects Colombian NIT (tax identification) numbers. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { co_nit: { action: "redact" } },
});

redactor.redact("NIT: 123456789-0");
// "NIT: [CO_NIT_1]"
```

- **ID**: `co_nit`
- **Entity type**: `co_nit`
- **Context required**: Yes (labels: Colombia, NIT, Tax, Impuesto, Tributario,
  Empresa)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: Format (9 digits + check digit)

## pe_dni

Detects Peruvian DNI numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { pe_dni: { action: "redact" } },
});

redactor.redact("DNI: 12345678");
// "DNI: [PE_DNI_1]"
```

- **ID**: `pe_dni`
- **Entity type**: `pe_dni`
- **Context required**: Yes (labels: Peru, Peruvian, Perú, Peruano, DNI,
  Documento Nacional, Identidad, RENIEC)
- **Stream supported**: Yes (maxMatchLength: 8)
- **Validation**: 8-digit format

## pe_ruc

Detects Peruvian RUC (tax identification) numbers. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { pe_ruc: { action: "redact" } },
});

redactor.redact("RUC: 12345678901");
// "RUC: [PE_RUC_1]"
```

- **ID**: `pe_ruc`
- **Entity type**: `pe_ruc`
- **Context required**: Yes (labels: Peru, Perú, RUC, Tax, SUNAT, Tributario)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: 11-digit format, prefix must be 10, 15, 17, or 20

## ve_cedula

Detects Venezuelan Cédula de Identidad numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { ve_cedula: { action: "redact" } },
});

redactor.redact("Cédula: V-12345678");
// "Cédula: [VE_CEDULA_1]"
```

- **ID**: `ve_cedula`
- **Entity type**: `ve_cedula`
- **Context required**: Yes (labels: Venezuela, Venezuelan, Cédula, Cedula,
  Identidad, CI)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: Format (V/E prefix + 1–8 digits)

## ve_rif

Detects Venezuelan RIF (tax identification) numbers. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { ve_rif: { action: "redact" } },
});

redactor.redact("RIF: J-12345678-9");
// "RIF: [VE_RIF_1]"
```

- **ID**: `ve_rif`
- **Entity type**: `ve_rif`
- **Context required**: Yes (labels: Venezuela, RIF, Tax, SENIAT, Tributario)
- **Stream supported**: Yes (maxMatchLength: 13)
- **Validation**: Format (V/E/J/G prefix + 8–9 digits + check digit)

## ec_cedula

Detects Ecuadorian Cédula de Identidad numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { ec_cedula: { action: "redact" } },
});

redactor.redact("Cédula: 1234567890");
// "Cédula: [EC_CEDULA_1]"
```

- **ID**: `ec_cedula`
- **Entity type**: `ec_cedula`
- **Context required**: Yes (labels: Ecuador, Ecuadorian, Cédula, Cedula,
  Identidad)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: 10-digit format, province code (1–24), third digit (≤6 or =9)

## uy_cedula

Detects Uruguayan Cédula de Identidad numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { uy_cedula: { action: "redact" } },
});

redactor.redact("Cédula: 1.234.567-8");
// "Cédula: [UY_CEDULA_1]"
```

- **ID**: `uy_cedula`
- **Entity type**: `uy_cedula`
- **Context required**: Yes (labels: Uruguay, Uruguayan, Cédula, Cedula,
  Identidad)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: Format (1 digit + 3 digits + 3 digits + check digit)

## uae_id

Detects UAE Emirates ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { uae_id: { action: "redact" } },
});

redactor.redact("Emirates ID: 784-1234-5678901-2");
// "Emirates ID: [UAE_ID_1]"
```

- **ID**: `uae_id`
- **Entity type**: `uae_id`
- **Context required**: Yes (labels: UAE, Emirates, Dubai, Abu Dhabi, National
  ID, Emirates ID)
- **Stream supported**: Yes (maxMatchLength: 18)
- **Validation**: Format (784 prefix + 12 digits + check digit)

## sa_id

Detects Saudi Arabian national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { sa_id: { action: "redact" } },
});

redactor.redact("National ID: 1234567890");
// "National ID: [SA_ID_1]"
```

- **ID**: `sa_id`
- **Entity type**: `sa_id`
- **Context required**: Yes (labels: Saudi, KSA, Kingdom, Iqama, National ID,
  Muqeem)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: Format (1 or 2 prefix + 9 digits)

## il_id

Detects Israeli national ID numbers (Teudat Zehut). Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { il_id: { action: "redact" } },
});

redactor.redact("Teudat Zehut: 123456789");
// "Teudat Zehut: [IL_ID_1]"
```

- **ID**: `il_id`
- **Entity type**: `il_id`
- **Context required**: Yes (labels: Israel, Teudat, Zehut, Israeli, National
  ID)
- **Stream supported**: Yes (maxMatchLength: 9)
- **Validation**: 9-digit format

## tr_id

Detects Turkish national ID numbers (TC Kimlik). Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { tr_id: { action: "redact" } },
});

redactor.redact("TC Kimlik: 12345678901");
// "TC Kimlik: [TR_ID_1]"
```

- **ID**: `tr_id`
- **Entity type**: `tr_id`
- **Context required**: Yes (labels: Turkey, Turkish, TC, Kimlik, National ID)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: 11-digit format (first digit 1–9)

## qa_id

Detects Qatari national ID numbers (QID). Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { qa_id: { action: "redact" } },
});

redactor.redact("QID: 12345678901");
// "QID: [QA_ID_1]"
```

- **ID**: `qa_id`
- **Entity type**: `qa_id`
- **Context required**: Yes (labels: Qatar, QID, Doha, National ID, Resident
  Permit)
- **Stream supported**: Yes (maxMatchLength: 11)
- **Validation**: 11-digit format

## kw_id

Detects Kuwaiti Civil ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { kw_id: { action: "redact" } },
});

redactor.redact("Civil ID: 123456789012");
// "Civil ID: [KW_ID_1]"
```

- **ID**: `kw_id`
- **Entity type**: `kw_id`
- **Context required**: Yes (labels: Kuwait, Civil ID, National ID)
- **Stream supported**: Yes (maxMatchLength: 12)
- **Validation**: 12-digit length, month field (1–12), day field (1–31)

## bh_cpr

Detects Bahraini CPR (Central Population Registry) numbers. Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { bh_cpr: { action: "redact" } },
});

redactor.redact("CPR: 123456789");
// "CPR: [BH_CPR_1]"
```

- **ID**: `bh_cpr`
- **Entity type**: `bh_cpr`
- **Context required**: Yes (labels: Bahrain, CPR, Central Population, National
  ID)
- **Stream supported**: Yes (maxMatchLength: 9)
- **Validation**: 9-digit length, month field (1–12), day field (1–31)

## om_id

Detects Omani national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { om_id: { action: "redact" } },
});

redactor.redact("Civil ID: 12345678");
// "Civil ID: [OM_ID_1]"
```

- **ID**: `om_id`
- **Entity type**: `om_id`
- **Context required**: Yes (labels: Oman, Muscat, Civil ID, National ID)
- **Stream supported**: Yes (maxMatchLength: 8)
- **Validation**: 8-digit format

## jo_id

Detects Jordanian national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { jo_id: { action: "redact" } },
});

redactor.redact("National ID: 1234567890");
// "National ID: [JO_ID_1]"
```

- **ID**: `jo_id`
- **Entity type**: `jo_id`
- **Context required**: Yes (labels: Jordan, Amman, National ID, Jordanian)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: 10-digit format

## lb_id

Detects Lebanese national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { lb_id: { action: "redact" } },
});

redactor.redact("National ID: 12345678");
// "National ID: [LB_ID_1]"
```

- **ID**: `lb_id`
- **Entity type**: `lb_id`
- **Context required**: Yes (labels: Lebanon, Lebanese, Beirut, National ID)
- **Stream supported**: Yes (maxMatchLength: 8)
- **Validation**: 7–8 digit format

## nz_driver_license

Detects New Zealand driver license numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { nz_driver_license: { action: "redact" } },
});

redactor.redact("Driver License: AB123456");
// "Driver License: [NZ_DRIVER_LICENSE_1]"
```

- **ID**: `nz_driver_license`
- **Entity type**: `nz_driver_license`
- **Context required**: Yes (labels: New Zealand, NZ, Kiwi, Driver License,
  Driver Licence, Driver, License, Licence)
- **Stream supported**: Yes (maxMatchLength: 8)
- **Validation**: Format (2 letters + 6 digits)

## nz_passport

Detects New Zealand passport numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { nz_passport: { action: "redact" } },
});

redactor.redact("Passport: AB123456");
// "Passport: [NZ_PASSPORT_1]"
```

- **ID**: `nz_passport`
- **Entity type**: `nz_passport`
- **Context required**: Yes (labels: New Zealand, NZ, Passport, Travel Document)
- **Stream supported**: Yes (maxMatchLength: 8)
- **Validation**: Format (2 letters + 6 digits)

## fj_id

Detects Fijian national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { fj_id: { action: "redact" } },
});

redactor.redact("National ID: ABC12345");
// "National ID: [FJ_ID_1]"
```

- **ID**: `fj_id`
- **Entity type**: `fj_id`
- **Context required**: Yes (labels: Fiji, Fijian, National ID, Identity)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: 8–10 alphanumeric character format

## png_id

Detects Papua New Guinean national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { png_id: { action: "redact" } },
});

redactor.redact("National ID: ABC123456789");
// "National ID: [PNG_ID_1]"
```

- **ID**: `png_id`
- **Entity type**: `png_id`
- **Context required**: Yes (labels: Papua New Guinea, Papua, New Guinea,
  National ID)
- **Stream supported**: Yes (maxMatchLength: 12)
- **Validation**: 8–12 alphanumeric character format

## ws_id

Detects Samoan national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { ws_id: { action: "redact" } },
});

redactor.redact("National ID: 1234567890");
// "National ID: [WS_ID_1]"
```

- **ID**: `ws_id`
- **Entity type**: `ws_id`
- **Context required**: Yes (labels: Samoa, Samoan, National ID, Identity)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: 8–10 digit format

## to_id

Detects Tongan national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { to_id: { action: "redact" } },
});

redactor.redact("National ID: ABC12345");
// "National ID: [TO_ID_1]"
```

- **ID**: `to_id`
- **Entity type**: `to_id`
- **Context required**: Yes (labels: Tonga, Tongan, National ID, Identity)
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: 8–10 alphanumeric character format

## nz_ird_extra

Detects additional New Zealand IRD number formats. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { nz_ird_extra: { action: "redact" } },
});

redactor.redact("IRD: 123456789");
// "IRD: [NZ_IRD_EXTRA_1]"
```

- **ID**: `nz_ird_extra`
- **Entity type**: `nz_ird_extra`
- **Context required**: Yes (labels: New Zealand, NZ, IRD, Tax, Inland Revenue)
- **Stream supported**: Yes (maxMatchLength: 9)
- **Validation**: 8–9 digit format

## id_nik

Detects Indonesian NIK (Nomor Induk Kependudukan) numbers. Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { id_nik: { action: "redact" } },
});

redactor.redact("NIK: 1234567890123456");
// "NIK: [ID_NIK_1]"
```

- **ID**: `id_nik`
- **Entity type**: `id_nik`
- **Context required**: Yes (labels: Indonesia, Indonesian, NIK, Nomor Induk,
  KTP, National ID)
- **Stream supported**: Yes (maxMatchLength: 16)
- **Validation**: 16-digit format

## id_npwp

Detects Indonesian NPWP (taxpayer identification) numbers. Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { id_npwp: { action: "redact" } },
});

redactor.redact("NPWP: 12.345.678.9-012.345");
// "NPWP: [ID_NPWP_1]"
```

- **ID**: `id_npwp`
- **Entity type**: `id_npwp`
- **Context required**: Yes (labels: Indonesia, NPWP, Tax, Pajak, Wajib Pajak)
- **Stream supported**: Yes (maxMatchLength: 20)
- **Validation**: Format (dotted digit groups)

## th_id

Detects Thai national ID numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { th_id: { action: "redact" } },
});

redactor.redact("National ID: 1234567890123");
// "National ID: [TH_ID_1]"
```

- **ID**: `th_id`
- **Entity type**: `th_id`
- **Context required**: Yes (labels: Thailand, Thai, National ID, บัตร, ประชาชน)
- **Stream supported**: Yes (maxMatchLength: 13)
- **Validation**: Thai national ID checksum (weighted sum, check digit)

## my_ic

Detects Malaysian IC (MyKad) numbers. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { my_ic: { action: "redact" } },
});

redactor.redact("IC Number: 123456-12-3456");
// "IC Number: [MY_IC_1]"
```

- **ID**: `my_ic`
- **Entity type**: `my_ic`
- **Context required**: Yes (labels: Malaysia, Malaysian, MyKad, IC Number, Kad
  Pengenalan)
- **Stream supported**: Yes (maxMatchLength: 14)
- **Validation**: 12-digit length, month field (1–12), day field (1–31)

## ph_umid

Detects Philippine UMID (Unified Multipurpose ID) numbers. Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { ph_umid: { action: "redact" } },
});

redactor.redact("UMID: 1234-1234567-8");
// "UMID: [PH_UMID_1]"
```

- **ID**: `ph_umid`
- **Entity type**: `ph_umid`
- **Context required**: Yes (labels: Philippines, Filipino, UMID, Unified,
  Multipurpose, National ID)
- **Stream supported**: Yes (maxMatchLength: 14)
- **Validation**: Format (4 digits + 7 digits + check digit)

## vn_cccd

Detects Vietnamese CCCD (Citizen Identity) numbers. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { vn_cccd: { action: "redact" } },
});

redactor.redact("CCCD: 123456789012");
// "CCCD: [VN_CCCD_1]"
```

- **ID**: `vn_cccd`
- **Entity type**: `vn_cccd`
- **Context required**: Yes (labels: Vietnam, Vietnamese, CCCD, Citizen
  Identity, CMND, National ID)
- **Stream supported**: Yes (maxMatchLength: 12)
- **Validation**: 12-digit format

## mm_nrc

Detects Myanmar NRC (National Registration Card) numbers. Requires nearby
context labels.

```ts
const redactor = createRedactor({
  rules: { mm_nrc: { action: "redact" } },
});

redactor.redact("NRC: 12/Yangon(N)123456");
// "NRC: [MM_NRC_1]"
```

- **ID**: `mm_nrc`
- **Entity type**: `mm_nrc`
- **Context required**: Yes (labels: Myanmar, Burmese, NRC, National
  Registration, Identity)
- **Stream supported**: Yes (maxMatchLength: 20)
- **Validation**: Format (division code + township + citizen type + 6 digits)
