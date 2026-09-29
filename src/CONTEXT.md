# Redaction engine

`index.ts` exposes immutable redactors and enforces complete-string input limits.
It also exports `listDetectors()` (returns `DetectorDescription[]` for all
built-in detectors) and `redactor.describe()` (returns `DetectorDescription[]`
for active rules only). Both expose `contextHint` metadata so callers can steer
LLMs to include required context labels. `DetectorDefinition.contextHint` is an
optional field on custom detectors; `validate.ts` validates its shape (labels
array, position enum, instructions string).
`policy.ts` orchestrates config validation, detector registration, and rule
resolution into a frozen policy. `presets.ts` houses the `BUILTIN_PRESETS` data
(flat rule sets per preset name); `policy.ts` imports it for resolution logic.
Built-in presets are flat (single rule set per preset name). Compliance presets
(`pii`, `gdpr`, `hipaa`, `ccpa`, `pci-dss`) expand to documented rule selections
— they are not compliance guarantees. Additional presets: `healthcare`,
`finance`, `education`, `soc2`, `security`. Custom presets are unversioned and
do not support `@version` syntax. `pii` includes 96 rules (all national-ID,
identity, financial, healthcare, crypto, contact, and logistics detectors).
`gdpr` includes 39 rules. `hipaa` includes 29 rules. `ccpa` includes 86 rules.
`pci-dss` includes 6 rules. `healthcare` includes 19 rules. `finance` includes
15 rules. `education` includes 6 rules. `soc2` includes 30 rules. `security`
includes 14 rules. Validation logic lives in `validate.ts`. `validate.ts`
validates config shape, limits, per-rule settings, and custom detector
definitions. Shared helpers (`isRecord`, `hasOnlyKeys`,
`isNonNegativeInteger`) are exported for cross-file reuse.

## Detector organization

All built-in detectors live under `detectors/` and are grouped by domain:

```
detectors/
  base.ts              Detector, ContextDetector, streamMeta, createContextMatcher, RegexDetector
  checksum.ts          Shared Luhn validation (luhnValid, npiLuhnValid)
  checksum-detector.ts ChecksumDetector (shared matchAll → validate pipeline)
  registry.ts          Built-in detector registry (imports all groups)
  contact/
    email.ts           EmailDetector
    phone.ts           PhoneDetector
  financial/
    payment-card.ts    PaymentCardDetector
    iban.ts            IbanDetector
    eu-vat.ts          EuVatDetector
    swift-bic.ts       SwiftBicDetector
    uk-sort-code.ts    UkSortCodeDetector
    us-routing.ts      UsRoutingDetector
    uk-bank-account.ts UkBankAccountDetector
    card-data.ts       CardDataDetector
    financial-reference.ts FinancialReferenceDetector
    investment-account.ts InvestmentAccountDetector
    payment-gateway-id.ts PaymentGatewayIdDetector
  national-id/
    ssn.ts             SSNDetector (US)
    uk-nino.ts         UkNinoDetector (UK)
    ca-sin.ts          CaSinDetector (Canada)
    au-tfn.ts          AuTfnDetector (Australia)
    jp-my-number.ts    JpMyNumberDetector (Japan)
    uk-nhs.ts          UkNhsDetector (UK)
    us-itin.ts         UsItinDetector (US)
    us-ein.ts          UsEinDetector (US)
    nz-ird.ts          NzIrdDetector (New Zealand)
    de-id.ts           DeIdDetector (Germany)
    fr-insee.ts        FrInseeDetector (France)
    it-codice-fiscale.ts ItCodiceFiscaleDetector (Italy)
    es-dni.ts          EsDniDetector (Spain)
    nl-bsn.ts          NlBsnDetector (Netherlands)
    pl-pesel.ts        PlPeselDetector (Poland)
    za-id.ts           ZaIdDetector (South Africa)
    ng-nin.ts          NgNinDetector (Nigeria)
    ng-bvn.ts          NgBvnDetector (Nigeria)
    ke-id.ts           KeIdDetector (Kenya)
    ke-kra-pin.ts      KeKraPinDetector (Kenya)
    eg-id.ts           EgIdDetector (Egypt)
    gh-card.ts         GhCardDetector (Ghana)
    ma-id.ts           MaIdDetector (Morocco)
    kz-iin.ts          KzIinDetector (Kazakhstan)
    uz-passport.ts     UzPassportDetector (Uzbekistan)
    uz-stir.ts         UzStirDetector (Uzbekistan)
    kg-pin.ts          KgPinDetector (Kyrgyzstan)
    tj-id.ts           TjIdDetector (Tajikistan)
    tm-passport.ts     TmPassportDetector (Turkmenistan)
    ru-passport.ts     RuPassportDetector (Russia)
    ru-snils.ts        RuSnilsDetector (Russia)
    ua-passport.ts     UaPassportDetector (Ukraine)
    ua-inn.ts          UaInnDetector (Ukraine)
    cz-id.ts           CzIdDetector (Czech Republic)
    ro-cnp.ts          RoCnpDetector (Romania)
    hu-id.ts           HuIdDetector (Hungary)
    hu-tax-id.ts       HuTaxIdDetector (Hungary)
    bg-egn.ts          BgEgnDetector (Bulgaria)
    rs-jmbg.ts         RsJmbgDetector (Serbia)
    ar-dni.ts          ArDniDetector (Argentina)
    ar-cuit.ts         ArCuitDetector (Argentina)
    cl-rut.ts          ClRutDetector (Chile)
    co-cedula.ts       CoCedulaDetector (Colombia)
    co-nit.ts          CoNitDetector (Colombia)
    pe-dni.ts          PeDniDetector (Peru)
    pe-ruc.ts          PeRucDetector (Peru)
    ve-cedula.ts       VeCedulaDetector (Venezuela)
    ve-rif.ts          VeRifDetector (Venezuela)
    ec-cedula.ts       EcCedulaDetector (Ecuador)
    uy-cedula.ts       UyCedulaDetector (Uruguay)
    uae-id.ts          UaeIdDetector (UAE)
    sa-id.ts           SaIdDetector (Saudi Arabia)
    il-id.ts           IlIdDetector (Israel)
    tr-id.ts           TrIdDetector (Turkey)
    qa-id.ts           QaIdDetector (Qatar)
    kw-id.ts           KwIdDetector (Kuwait)
    bh-cpr.ts          BhCprDetector (Bahrain)
    om-id.ts           OmIdDetector (Oman)
    jo-id.ts           JoIdDetector (Jordan)
    lb-id.ts           LbIdDetector (Lebanon)
    nz-driver-license.ts NzDriverLicenseDetector (New Zealand)
    nz-passport.ts     NzPassportDetector (New Zealand)
    fj-id.ts           FjIdDetector (Fiji)
    png-id.ts          PngIdDetector (Papua New Guinea)
    ws-id.ts           WsIdDetector (Samoa)
    to-id.ts           ToIdDetector (Tonga)
    nz-ird-extra.ts    NzIrdExtraDetector (New Zealand)
    id-nik.ts          IdNikDetector (Indonesia)
    id-npwp.ts         IdNpwpDetector (Indonesia)
    th-id.ts           ThIdDetector (Thailand)
    my-ic.ts           MyIcDetector (Malaysia)
    ph-umid.ts         PhUmidDetector (Philippines)
    vn-cccd.ts         VnCccdDetector (Vietnam)
    mm-nrc.ts          MmNrcDetector (Myanmar)
  identity/
    passport.ts        PassportDetector
    drivers-license.ts  DriversLicenseDetector
    digital-identity.ts DigitalIdentityDetector
    license-plate.ts   LicensePlateDetector
    vin.ts              VinDetector
    imei.ts            ImeiDetector
    imsi.ts            ImsiDetector
  person/
    person-name.ts      PersonNameDetector (compromise NER, opt-in)
    person-name-lite.ts  PersonNameLiteDetector (lightweight regex + bloom filter)
    person-name-data.ts  Auto-generated bloom filter data (do not edit)
  network/
    ipv4.ts            Ipv4Detector
    ipv6.ts            Ipv6Detector
    mac-address.ts     MacAddressDetector
    url-with-auth.ts   UrlWithAuthDetector
  cloud/
    aws-access-key.ts  AwsAccessKeyDetector
    google-api-key.ts  GoogleApiKeyDetector
    stripe-api-key.ts  StripeApiKeyDetector
    slack-token.ts     SlackTokenDetector
  token/
    github-token.ts    GitHubTokenDetector
    jwt-token.ts       JwtTokenDetector
    private-key.ts     PrivateKeyDetector
    generic-api-key.ts GenericApiKeyDetector
  logistics/
    tracking-number.ts TrackingNumberDetector
  healthcare/
    us-npi.ts          UsNpiDetector
    us-dea.ts          UsDeaDetector
    medical-record-number.ts MedicalRecordNumberDetector
    clinical-trial-id.ts ClinicalTrialIdDetector
    medical-device-id.ts MedicalDeviceIdDetector
    medical-code.ts    MedicalCodeDetector
    medical-reference.ts MedicalReferenceDetector
    genetic-info.ts    GeneticInfoDetector
    health-insurance-id.ts HealthInsuranceIdDetector
  hr/
    hr-identifier.ts   HrIdentifierDetector
    hr-screening.ts    HrScreeningDetector
    hr-compensation.ts HrCompensationDetector
    hr-recruitment.ts  HrRecruitmentDetector
  legal/
    legal-case.ts      LegalCaseDetector
    legal-license.ts   LegalLicenseDetector
    legal-reference.ts LegalReferenceDetector
  crypto/
    crypto-address.ts  CryptoAddressDetector
    crypto-tx-hash.ts  CryptoTxHashDetector
```

`detectors/base.ts` defines the abstract `Detector` base class,
`ContextDetector` (shared pattern + context matching pipeline for
context-required detectors), `streamMeta()` helper (constructs frozen stream
metadata objects), `createContextMatcher`, and `RegexDetector` (wraps
user-supplied `DetectorDefinition`s). The base class shares grapheme boundary
enforcement (`filterGraphemeAligned` / `assertGraphemeAligned`) and
adjacent-character checks (`isAdjacentForbidden` / `isStartForbidden` /
`isEndForbidden`) across all detectors. `ContextDetector` provides a shared
`detect()` pipeline: `matchAll` on `pattern`, `isAdjacentForbidden` check,
`validate()` (overridable, returns non-context reasons or `false`),
`hasContext` check, and `filterGraphemeAligned`. The base class appends
`${this.id}.context` to the reasons from `validate()`. Subclasses set
`pattern`, `contextLabels`, `leftContext`, `rightContext`, and `stream` via
`streamMeta()`. Public definitions expose pattern, optional validator and
optional finite stream metadata; metadata alone does not prove a regex stream
safe. Custom synchronous code is trusted and cannot be interrupted.
`detectors/registry.ts` owns the built-in detector registry. Contributors add a
new built-in detector by exporting a singleton from its own file and adding one
entry to the registry array — no orchestration code changes required.
`detectors/checksum.ts` exports `luhnValid` and `npiLuhnValid` — shared Luhn
checksum validation used by `financial/payment-card.ts`, `national-id/ca-sin.ts`,
`financial/eu-vat.ts`, `contact/phone.ts`, `healthcare/us-npi.ts`, and various
national-ID detectors. `detectors/checksum-detector.ts` defines
`ChecksumDetector`, an abstract class extending `Detector` that provides a shared
`detect()` pipeline: `matchAll` collects regex candidates, `validate` filters
invalid ones, and the base class handles grapheme alignment and adjacency
checks. Detectors that perform checksum validation (ca-sin, au-tfn, jp-my-number,
payment-card, eu-vat, nz-ird, us-itin, cl-rut, co-nit, pe-ruc, ve-rif, ro-cnp,
rs-jmbg, bg-egn, pl-pesel, th-id, bsn, insee) extend `ChecksumDetector` instead
of duplicating the detect pipeline in each file. Context-required detectors
that don't need checksum validation extend `ContextDetector` instead — this
covers 97 detectors across national-id, contact, financial, healthcare, HR,
legal, identity, and crypto domains, saving ~3300 lines of boilerplate.

### Contact detectors

`contact/email.ts` implements `EmailDetector` (extends `Detector`); exported as
a singleton. Declares stream metadata (maxMatchLength 254, no context needed) so
the streaming engine can process emails across chunk boundaries.
`contact/phone.ts` implements `PhoneDetector` (extends `Detector`): detects
international phone numbers with optional `+` prefix, 7–15 digits, and common
separators (spaces, hyphens, dots). Context-optional. Exported as a singleton.
`contact/address.ts` implements `AddressDetector` (extends `ContextDetector`):
detects street addresses. Context-required. Exported as a singleton.
`contact/postal-code.ts` implements `PostalCodeDetector` (extends `Detector`):
detects postal codes. Context-optional. Exported as a singleton.

### Financial detectors

`financial/payment-card.ts` implements `PaymentCardDetector` (extends
`ChecksumDetector`): 13–19 ASCII digits, single-separator groups, Luhn
validation, no substring extraction from longer candidates, and grapheme-aligned
boundary enforcement. Exported as a singleton.
`financial/iban.ts` implements `IbanDetector` (extends `Detector`): detects
IBANs for SEPA countries using a country-length map and mod-97 checksum
validation (via BigInt). The regex uses `{1,4}` group sizes and truncates
non-digit trailing groups (e.g. " C" from "Card") to find valid IBANs within
over-matches. `maxMatchLength: 38`. Context-optional. Exported as a singleton.
`financial/eu-vat.ts` implements `EuVatDetector` (extends
`ChecksumDetector`): detects EU VAT numbers for DE (format only), FR (Luhn on
SIREN), IT (Luhn), ES (mod-23 letter check), and NL (mod-11 weighted sum).
`maxMatchLength: 15`. Context-optional. Exported as a singleton.
`financial/swift-bic.ts` implements `SwiftBicDetector` (extends
`ContextDetector`): detects SWIFT/BIC codes (8 or 11 chars, bank code +
country + location + optional branch). Context-required. Exported as a
singleton.
`financial/uk-sort-code.ts` implements `UkSortCodeDetector` (extends
`ContextDetector`): detects UK bank sort codes (6 digits, hyphenated or
spaced formats). Context-required. Exported as a singleton.
`financial/us-routing.ts` implements `UsRoutingDetector` (extends
`ContextDetector`): detects US ABA routing numbers (9 digits, starts with
0-1, 1-2, 2-1, 2-2, followed by 0 or 0-0). Context-required. Exported as a
singleton. Includes `validate()` override for checksum validation.
`financial/uk-bank-account.ts` implements `UkBankAccountDetector` (extends
`ContextDetector`): detects UK bank account numbers (6-8 digits).
Context-required. Exported as a singleton.

### National ID detectors

`national-id/ssn.ts` implements `SSNDetector` (extends `ContextDetector`):
9-digit compact or 3-2-4 hyphenated candidates with structural exclusions
(000/666/900–999, 00, 0000), qualified by bounded English context labels (SSN,
Social Security Number, Social Security No.) in preceding or following
position. Context windows are bounded by the same constants used for stream
declarations, so complete-string and streaming share identical context limits.
Only the numeric span is transformed. Exported as a singleton.
`national-id/uk-nino.ts` implements `UkNinoDetector` (extends `Detector`): 2
prefix letters, 6 digits, 1 suffix letter in compact (`AB123456C`) or spaced
(`AB 12 34 56 C`) formats. Validates prefix (excludes D/F/I/Q/U/V in first
position, O in second) and suffix (A-D/F/J/H/M/N/P/R/S/T/W/X/Y/Z).
Context-optional. Exported as a singleton.
`national-id/ca-sin.ts` implements `CaSinDetector` (extends
`ChecksumDetector`): 9-digit Canadian SIN in hyphenated (`123-456-789`) or
compact (`123456789`) formats, Luhn-validated. Context-optional. Exported as a
singleton.
`national-id/au-tfn.ts` implements `AuTfnDetector` (extends
`ChecksumDetector`): 8-9 digit Australian TFN in compact or spaced
(`123 456 789`) formats, validated via weighted sum mod 11 (weights:
1,4,3,7,5,8,6,9,10). Context-optional. Exported as a singleton.
`national-id/jp-my-number.ts` implements `JpMyNumberDetector` (extends
`ChecksumDetector`): 12-digit Japanese My Number in compact or spaced
(`1234 5678 9012`) formats, validated via weighted sum mod 11 (weights:
6,5,4,3,2,7,6,5,4,3,2 for first 11 digits, 12th is check digit).
Context-optional. Exported as a singleton.
`national-id/uk-nhs.ts` implements `UkNhsDetector` (extends `ContextDetector`):
detects UK NHS numbers (10 digits, mod-11 checksum validation). Context-required.
Exported as a singleton.
`national-id/us-itin.ts` implements `UsItinDetector` (extends
`ChecksumDetector`): detects US ITIN numbers (9XX-7X-XXXX or 9XX-8X-XXXX
format, Luhn-validated). Context-optional. Exported as a singleton.
`national-id/us-ein.ts` implements `UsEinDetector` (extends `ContextDetector`):
detects US EIN numbers (XX-XXXXXXX format). Context-required. Exported as a
singleton.
`national-id/nz-ird.ts` implements `NzIrdDetector` (extends
`ChecksumDetector`): detects New Zealand IRD numbers (8-9 digits, mod-11
weighted sum validation). Context-optional. Exported as a singleton.

### Identity detectors

`identity/passport.ts` implements `PassportDetector` (extends
`ContextDetector`): detects US/UK (9 digits), CA (2 letters + 6 digits), and
AU (2 letters + 7 digits) passport numbers. Context-required (labels: Passport,
Passport No., Passport Number). `maxMatchLength: 9`. Exported as a singleton.
`identity/drivers-license.ts` implements `DriversLicenseDetector` (extends
`ContextDetector`): detects US (state-specific), UK (16 chars), CA (1 letter +
9 digits), and AU driver's license numbers. Broad `[A-Z0-9]{6,16}` regex with
digit requirement and context qualification. Context-required (labels: Driver's
License, DL, License No., Driving Licence). `maxMatchLength: 16`. Exported as a
singleton.

### Person detectors

`person/person-name-lite.ts` implements `PersonNameLiteDetector` (extends
`Detector`): lightweight regex + bloom filter detector. Regex finds candidate
sequences (optional honorific + 1–4 capitalized words + optional suffix).
Single-word names only matched with honorific prefix. Multi-word names require
at least one word in the bloom filter AND not in the stopword set. Trims
trailing punctuation and possessive `'s`. Reasons:
`["person_name_lite.bloom"]`. `maxMatchLength: 40`. Context-optional. Exported
as a singleton. Included in pii, hipaa, gdpr, healthcare, education, and soc2
presets.

`person/person-name.ts` implements `PersonNameDetector` (extends `Detector`):
uses compromise.js NER to detect person names. Trims trailing punctuation
(unless the last term is an abbreviation like "Jr.") and possessive `'s` from
matches. Throws `INVALID_CONFIG` when compromise is not installed. Reasons:
`["person_name.ner"]`. `maxMatchLength: 40`. Context-optional. Exported as a
singleton. Opt-in only (not in any preset); users must add an explicit rule.

`person/person-name-data.ts` is auto-generated by
`scripts/generate-bloom-filter.ts` (run via `bun run generate:bloom`). Contains
a bloom filter (m=1,426,775 bits, k=10 hashes, ~178 KB raw, ~233 KB base64)
built from 99,236 unique lowercase names sourced from wikidata-names,
compromise lexicon, and faker Latin locales. Also contains a stopword set (218
common English words that overlap the name dataset). Uses FNV-1a + DJB2 double
hashing. Measured FPR: ~0.1%.

**Performance:** The lightweight `person_name_lite` detector adds negligible
overhead (no NLP dependency). The `person_name` detector (NER) adds ~178 MiB
RSS and reduces throughput by 4 orders of magnitude (0.06 MiB/s vs 505 MiB/s
without it).

### Network detectors

`network/ipv4.ts` implements `Ipv4Detector` (extends `Detector`): detects IPv4
addresses (4 octets, 0-255 each). Context-optional. Exported as a singleton.
`network/ipv6.ts` implements `Ipv6Detector` (extends `Detector`): detects IPv6
addresses (8 groups of 4 hex digits, with zero-compression support).
Context-optional. Exported as a singleton.
`network/mac-address.ts` implements `MacAddressDetector` (extends `Detector`):
detects MAC addresses (6 hex pairs, colon or hyphen separated). Context-optional.
Exported as a singleton.
`network/url-with-auth.ts` implements `UrlWithAuthDetector` (extends `Detector`):
detects URLs with embedded credentials (`https://user:pass@host`). Context-optional.
Exported as a singleton.

### Cloud provider key detectors

`cloud/aws-access-key.ts` implements `AwsAccessKeyDetector` (extends `Detector`):
detects AWS access key IDs (AKIA followed by 16 base64 chars). Context-optional.
Exported as a singleton.
`cloud/google-api-key.ts` implements `GoogleApiKeyDetector` (extends `Detector`):
detects Google API keys (AIza followed by 35 base64 chars). Context-optional.
Exported as a singleton.
`cloud/stripe-api-key.ts` implements `StripeApiKeyDetector` (extends `Detector`):
detects Stripe API keys (sk_live_ or sk_test_ followed by alphanumeric chars).
Context-optional. Exported as a singleton.
`cloud/slack-token.ts` implements `SlackTokenDetector` (extends `Detector`):
detects Slack tokens (xoxb-, xoxp-, xoxa-, xoxr- followed by alphanumeric chars).
Context-optional. Exported as a singleton.

### Token and key detectors

`token/github-token.ts` implements `GitHubTokenDetector` (extends `Detector`):
detects GitHub personal access tokens (ghp_, gho_, ghu_, ghs_, ghr_ followed by
36 base62 chars). Context-optional. Exported as a singleton.
`token/jwt-token.ts` implements `JwtTokenDetector` (extends `Detector`): detects
JWT tokens (3 base64url segments separated by dots). Context-optional. Exported
as a singleton.
`token/private-key.ts` implements `PrivateKeyDetector` (extends `Detector`):
detects PEM-encoded private keys (RSA, EC, OpenSSH, PGP). Context-optional.
Exported as a singleton.
`token/generic-api-key.ts` implements `GenericApiKeyDetector` (extends `Detector`):
detects generic API keys with context labels (API key, API secret, access token,
etc.). Context-required. Exported as a singleton.

### Healthcare detectors

`healthcare/us-npi.ts` implements `UsNpiDetector` (extends `Detector`): detects
US National Provider Identifier (10 digits, Luhn check with prefix 80840).
Context-optional. Exported as a singleton.
`healthcare/us-dea.ts` implements `UsDeaDetector` (extends `ContextDetector`):
detects US DEA numbers (2 letters + 7 digits, checksum validation).
Context-required. Exported as a singleton.
`healthcare/medical-record-number.ts` implements `MedicalRecordNumberDetector`
(extends `ContextDetector`): detects medical record numbers with context
labels (MRN, Medical Record, Medical Record Number). Context-required.
Exported as a singleton.

### National ID detectors (extended)

65 new national-ID detectors across `national-id/`. Each extends
`ContextDetector` (context-required with pattern + contextLabels) or
`ChecksumDetector` (checksum-validated, context-optional). Detectors with
checksum validation (Luhn, mod-11, mod-23, mod-97, or custom algorithms) extend
`ChecksumDetector`; others extend `ContextDetector` with optional `validate()`
overrides for structural checks. All are context-required unless noted
otherwise. See `national-id/` directory for individual detector implementations.

### Identity detectors (extended)

`identity/digital-identity.ts` implements `DigitalIdentityDetector` (extends
`Detector`): detects digital identity tokens (alphanumeric, 6-20 chars).
Context-required. Uses custom context matching logic (different rules for
@handles, numeric IDs, Steam IDs vs generic usernames). Exported as a singleton.
`identity/license-plate.ts` implements `LicensePlateDetector` (extends
`ContextDetector`): detects license plates (various international formats).
Context-required. Exported as a singleton.

### Financial detectors (extended)

`financial/card-data.ts` implements `CardDataDetector` (extends
`ContextDetector`): detects card data tokens. Context-required. Exported as a
singleton.
`financial/financial-reference.ts` implements `FinancialReferenceDetector`
(extends `ContextDetector`): detects financial reference numbers.
Context-required. Exported as a singleton.
`financial/investment-account.ts` implements `InvestmentAccountDetector`
(extends `ContextDetector`): detects investment account numbers.
Context-required. Exported as a singleton.
`financial/payment-gateway-id.ts` implements `PaymentGatewayIdDetector`
(extends `ContextDetector`): detects payment gateway IDs. Context-required.
Exported as a singleton.

### Healthcare detectors (extended)

`healthcare/clinical-trial-id.ts` implements `ClinicalTrialIdDetector`
(extends `ContextDetector`): detects clinical trial identifiers (NCT followed
by 8 digits). Context-required. Exported as a singleton.
`healthcare/medical-device-id.ts` implements `MedicalDeviceIdDetector`
(extends `ContextDetector`): detects medical device identifiers (UDI format).
Context-required. Exported as a singleton.
`healthcare/medical-code.ts` implements `MedicalCodeDetector` (extends
`ContextDetector`): detects medical codes (ICD-10, CPT, HCPCS).
Context-required. Exported as a singleton. Includes `validate()` override for
CPT code range validation.
`healthcare/medical-reference.ts` implements `MedicalReferenceDetector`
(extends `ContextDetector`): detects medical reference numbers.
Context-required. Exported as a singleton.
`healthcare/genetic-info.ts` implements `GeneticInfoDetector` (extends
`ContextDetector`): detects genetic information markers (RS numbers, DNA
sequences). Context-required. Exported as a singleton.
`healthcare/health-insurance-id.ts` implements `HealthInsuranceIdDetector`
(extends `ContextDetector`): detects health insurance IDs. Context-required.
Exported as a singleton.

### HR detectors

`hr/hr-identifier.ts` implements `HrIdentifierDetector` (extends
`ContextDetector`): detects HR identifiers. Context-required. Exported as a
singleton.
`hr/hr-screening.ts` implements `HrScreeningDetector` (extends
`ContextDetector`): detects HR screening IDs. Context-required. Exported as a
singleton.
`hr/hr-compensation.ts` implements `HrCompensationDetector` (extends
`Detector`): detects compensation data. Context-required. Uses custom `detect()`
with dual patterns and deduplication. Exported as a singleton.
`hr/hr-recruitment.ts` implements `HrRecruitmentDetector` (extends
`ContextDetector`): detects recruitment IDs. Context-required. Exported as a
singleton.

### Legal detectors

`legal/legal-case.ts` implements `LegalCaseDetector` (extends
`ContextDetector`): detects legal case numbers. Context-required. Exported as
a singleton.
`legal/legal-license.ts` implements `LegalLicenseDetector` (extends
`ContextDetector`): detects legal license numbers. Context-required. Exported
as a singleton.
`legal/legal-reference.ts` implements `LegalReferenceDetector` (extends
`ContextDetector`): detects legal reference numbers. Context-required.
Exported as a singleton.

### Crypto detectors

`crypto/crypto-address.ts` implements `CryptoAddressDetector` (extends
`Detector`): detects cryptocurrency addresses (Bitcoin, Ethereum, etc.).
Context-optional. Exported as a singleton.
`crypto/crypto-tx-hash.ts` implements `CryptoTxHashDetector` (extends
`ContextDetector`): detects cryptocurrency transaction hashes. Context-required.
Exported as a singleton.

### Identity detectors (VIN/IMEI/IMSI)

`identity/vin.ts` implements `VinDetector` (extends `ChecksumDetector`):
detects 17-character Vehicle Identification Numbers (ISO 3779). Excludes
I/O/Q; validates via mod-11 transliteration checksum. Context-optional.
Exported as a singleton.
`identity/imei.ts` implements `ImeiDetector` (extends `ChecksumDetector`):
detects 15-digit IMEI and 16-digit IMEISV numbers. Validates 15 digits via
Luhn; for 16-digit IMEISV, validates the first 15 digits. Context-optional.
Exported as a singleton.
`identity/imsi.ts` implements `ImsiDetector` (extends `ContextDetector`):
detects 15-digit IMSI (International Mobile Subscriber Identity) numbers.
Context-required (labels: IMSI, Subscriber ID, Subscriber Number, Mobile
Subscriber). Rejects all-same-digit numbers and Luhn-valid numbers to avoid
IMEI overlap. Exported as a singleton.

### Logistics detectors

`logistics/tracking-number.ts` implements `TrackingNumberDetector` (extends
`ContextDetector`): detects package tracking numbers for UPS (1Z + 16 chars,
mod-10), FedEx Express (12 digits, mod-11), FedEx Ground (15 digits, mod-10),
USPS (20-22 digits, mod-10), and DHL (10 digits, mod-7). Context-required
(labels: tracking, tracking number, shipment, waybill, parcel). Exported as
a singleton.

## Core engine

`engine.ts` discovers original spans, forms transitive overlap groups, resolves
remove > redact > format-preserve > token-replace > mask precedence, and renders
output plus opt-in reports. `renderFormatPreserve()` transforms digits to `X`
and letters to `*` while keeping separators and structure. `renderTokenReplace()`
generates deterministic fake data per entity type using `fnv1a32()` hashing;
optional custom token mappings override defaults. `DEFAULT_TOKEN_GENERATORS`
provides idempotent fake values for all 129 entity types (designed to not match
any detector). Coverage: all 128 detector entity types plus `person_name_lite`.
Fake values are constant (input-agnostic), format-valid, and idempotent —
context-required detectors lack context labels in output, checksum-validated
detectors fail checksum, and context-optional detectors use values that don't
match the regex. Masks count grapheme clusters; hidden regions union across
contributing matches. Redact priority is explicit, and equally ranked different
replacements fall back to [REDACTED]. Adjacent spans remain separate groups.
Idempotency is enforced via placeholder filtering: `findPlaceholderSpans` scans
for `[UPPERCASE]` and `[UPPERCASE_N]` patterns (including `[REDACTED]`), and
`filterPlaceholderMatches` drops any detection overlapping those spans so
re-redacting already-redacted text is a no-op. The public seam between engine
and stream is `detectAndRender`: it collects matches from all rules, filters
placeholder overlaps, and renders the safe portion up to a flush point.
`processText` delegates to `detectAndRender` for complete-string use;
`stream.ts` calls `detectAndRender` per flush. Internal helpers (`AppliedMatch`,
`findPlaceholderSpans`, `filterPlaceholderMatches`, `filterAllowlisted`,
`renderSafePortion`) are not exported.

**Allowlist:** `config.allowlist` accepts an array of exact-match strings that
are exempt from redaction. The allowlist is case-sensitive, no regex, converted
to a `Set<string>` for O(1) lookup. Filtering happens after placeholder
filtering but before rendering, so allowlisted values never appear in
restoration maps. Works with all actions and in streaming mode.

**Detect-only mode:** `config.detectOnly` (boolean) skips redaction and
restoration entirely — the redactor runs detectors but returns unmodified
text. Useful for auditing what PII would be detected without altering the
output. `detectOnly: true` combined with `restore: true` throws
`INVALID_CONFIG`. Threaded through `policy.ts`, `engine.ts`, `stream.ts`,
and all adapters.

`types.ts` holds UTF-16 reports, transformations and the registered detector seam.
It also defines `ContextHint` (labels, position, window, instructions) and
`DetectorDescription` (id, entityType, replacement, stream, optional contextHint)
used by the `listDetectors()` and `redactor.describe()` APIs for LLM steering.
`grapheme.ts` owns the shared `Intl.Segmenter` instance and grapheme utilities
(`segment`, `graphemeBoundaries`, `isGraphemeAligned`).
Both `detectors/base.ts` and `engine.ts` import from here so grapheme logic has
one home; future streaming code can reuse the same utilities.
`employee-id.ts` exports a `DetectorDefinition` example (`employee_id_example`)
demonstrating the public extension contract. It is not a built-in and not in
the registry; users import and pass it via `config.detectors`.
`errors.ts` contains library-defined safe error messages and configuration paths.
Default processing never constructs original-value inspection reports.
`SensoredError.toProblemDetails()` serializes to an RFC 9457 Problem Details
object with a default HTTP status mapping (400/409/413/424/499/500). The
application owns status mapping via an optional override; supplied 5xx statuses
other than 500 throw. `SensoredError` carries an optional `info` record for
structured metadata (e.g. available preset versions). Published modules use
standard APIs, with no Bun imports.
`stream.ts` implements the streaming engine: buffers chunks, calculates safe
flush boundaries from detector stream metadata, adjusts for grapheme clusters,
calls `detectAndRender` from `engine.ts` to collect matches and render resolved
text, and emits stream events. Supports cancellation (AbortSignal), buffer
limits (65 536 UTF-16 units), source error wrapping, and opt-in detection
reporting with absolute offsets. Throws `STREAM_UNSUPPORTED` when any active rule
lacks stream metadata.
`traverse.ts` exports `redactValue<T>(input, redactor)` — recursively traverses
objects, arrays, and symbol-keyed properties, calling `redactor.redact()` on
every string value. Sensitive field names (password, secret, token,
authorization, api_key, etc.) are unconditionally redacted to `"[REDACTED]"`
regardless of content type (strings, numbers, objects, booleans all become
`"[REDACTED]"`; null/undefined pass through). Never mutates input; uses a
WeakSet for circular reference safety. Used by logging adapters (pino, winston)
and LLM adapters (openai, anthropic) to redact structured data.
`stream-restore.ts` exports `StreamRestorer` — restores placeholders in
streaming responses where a placeholder may be split across chunk boundaries.
`push(chunk)` returns restorable text, holding back partial placeholders up to
`MAX_PARTIAL_LENGTH`. `flush()` emits any remaining held text. Uses `restore()`
from `restore.ts` and pattern constants from `placeholders.ts`. Used by the
openai and anthropic streaming adapters.
`restore.ts` exports the `restore(text, map)` function that reverses redacted
text back to its original form using a `RestorationMap` (placeholder → original
value). Uses `PLACEHOLDER_PATTERN` from `placeholders.ts`. When `config.restore`
is `true`, `redact()` returns `{ text, map }`
instead of a plain string; the map uses numbered per-entity-type placeholders
(e.g. `[EMAIL_1]`, `[PHONE_2]`). Restoration works with all actions (redact, mask, remove, format-preserve,
token-replace) and is idempotent. The `createRedactor` function uses TypeScript
overloads so callers with `restore: true` get a `RedactResult` return type while
callers without it get `string`, preserving backward compatibility.
`placeholders.ts` exports the shared `PLACEHOLDER_PATTERN` (matches numbered
placeholders like `[EMAIL_1]`) and `PARTIAL_PATTERN` (matches incomplete
placeholders split across chunk boundaries). Imported by `restore.ts` and
`stream-restore.ts` so placeholder format lives in one module.

**Security note:** The `RestorationMap` contains plaintext PII mappings
(placeholder → original value). The map is frozen via `Object.freeze()` but is
not encrypted or cleared from memory. Callers must treat the map as sensitive:
do not log it, serialize it to unencrypted storage, or transmit it over
unsecured channels. JavaScript strings are immutable and cannot be securely
zeroed; the map will persist in memory until garbage-collected.
