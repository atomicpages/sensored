# Identity Detectors

## passport

Detects passport numbers for US/UK (9 digits), CA (2 letters + 6 digits), and
AU (2 letters + 7 digits). Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { passport: { action: "redact" } },
});

redactor.redact("Passport No.: 123456789");
// "Passport No.: [PASSPORT_1]"
```

- **ID**: `passport`
- **Entity type**: `passport`
- **Context required**: Yes (labels: Passport, Passport No., Passport Number)
- **Stream supported**: Yes (maxMatchLength: 9)
- **Validation**: Country-specific format (digits, letter+digit combinations)

## drivers_license

Detects driver's license numbers for US (state-specific), UK (16 chars), CA
(1 letter + 9 digits), and AU. Uses a broad `[A-Z0-9]{6,16}` regex with a digit
requirement and context qualification.

```ts
const redactor = createRedactor({
  rules: { drivers_license: { action: "redact" } },
});

redactor.redact("Driver's License: D12345678");
// "Driver's License: [DRIVERS_LICENSE_1]"
```

- **ID**: `drivers_license`
- **Entity type**: `drivers_license`
- **Context required**: Yes (labels: Driver's License, DL, License No., Driving Licence)
- **Stream supported**: Yes (maxMatchLength: 16)
- **Validation**: Format (6–16 alphanumeric chars with at least one digit), context label

## digital_identity

Detects digital identity tokens including usernames, @handles, Discord IDs,
Steam IDs, and numeric platform IDs. Context-required with custom context
matching logic.

```ts
const redactor = createRedactor({
  rules: { digital_identity: { action: "redact" } },
});

redactor.redact("Username: john_doe123");
// "Username: [DIGITAL_IDENTITY_1]"
```

- **ID**: `digital_identity`
- **Entity type**: `digital_identity`
- **Context required**: Yes (labels: Username, User ID, Handle, Screen Name, Gamertag, Discord ID, Steam ID, PSN ID, Xbox Gamertag)
- **Stream supported**: Yes (maxMatchLength: 32)
- **Validation**: Custom context matching — @handles, numeric IDs (17–19 digits), and Steam IDs use any context; generic usernames require preceding context. Rejects blocklisted words and pure numeric strings.

## license_plate

Detects vehicle license plates in various international formats. Requires
nearby context labels.

```ts
const redactor = createRedactor({
  rules: { license_plate: { action: "redact" } },
});

redactor.redact("License Plate: AB12 CDE");
// "License Plate: [LICENSE_PLATE_1]"
```

- **ID**: `license_plate`
- **Entity type**: `license_plate`
- **Context required**: Yes (labels: License Plate, Plate Number, Registration, Vehicle Registration, License Plate Number, Tag Number, License Plate No., Plate No.)
- **Stream supported**: Yes (maxMatchLength: 15)
- **Validation**: Context label presence, length (2–15 chars), at least one digit required

## vin

Detects 17-character Vehicle Identification Numbers (ISO 3779). Excludes
I/O/Q; validates via mod-11 transliteration checksum. Context-optional.

```ts
const redactor = createRedactor({
  rules: { vin: { action: "redact" } },
});

redactor.redact("VIN: 1HGBH41JXMN109186");
// "VIN: [VIN_1]"
```

- **ID**: `vin`
- **Entity type**: `vin`
- **Context required**: No
- **Stream supported**: Yes (maxMatchLength: 17)
- **Validation**: 17 chars (excludes I/O/Q), mod-11 transliteration checksum, rejects all-same-character strings

## imei

Detects 15-digit IMEI and 16-digit IMEISV numbers. Validates 15 digits via
Luhn; for 16-digit IMEISV, validates the first 15 digits. Context-optional.

```ts
const redactor = createRedactor({
  rules: { imei: { action: "redact" } },
});

redactor.redact("IMEI: 490154203237518");
// "IMEI: [IMEI_1]"
```

- **ID**: `imei`
- **Entity type**: `imei`
- **Context required**: No
- **Stream supported**: Yes (maxMatchLength: 16)
- **Validation**: 15–16 digits, Luhn checksum (on first 15 digits for IMEISV), rejects all-same-digit strings

## imsi

Detects 15-digit IMSI (International Mobile Subscriber Identity) numbers.
Context-required. Rejects all-same-digit numbers and Luhn-valid numbers to
avoid IMEI overlap.

```ts
const redactor = createRedactor({
  rules: { imsi: { action: "redact" } },
});

redactor.redact("Subscriber ID: 310150123456789");
// "Subscriber ID: [IMSI_1]"
```

- **ID**: `imsi`
- **Entity type**: `imsi`
- **Context required**: Yes (labels: IMSI, Subscriber ID, Subscriber Number, Mobile Subscriber)
- **Stream supported**: Yes (maxMatchLength: 15)
- **Validation**: 15 digits, rejects all-same-digit and Luhn-valid numbers
