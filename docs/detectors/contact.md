# Contact Detectors

## email

Detects email addresses.

```ts
const redactor = createRedactor({
  rules: { email: { action: "redact" } },
});

redactor.redact("Contact: john@example.com");
// "Contact: [EMAIL_1]"
```

- **ID**: `email`
- **Entity type**: `email`
- **Context required**: No
- **Stream supported**: Yes (maxMatchLength: 254)
- **Validation**: RFC-style email pattern with local part and domain

## phone

Detects international phone numbers with optional `+` prefix, 7–15 digits, and
common separators (spaces, hyphens, dots).

```ts
const redactor = createRedactor({
  rules: { phone: { action: "redact" } },
});

redactor.redact("Call +1 (555) 123-4567");
// "Call [PHONE_1]"
```

- **ID**: `phone`
- **Entity type**: `phone`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Digit count, separator patterns, length bounds (7–15 digits)

## address

Detects street addresses. Requires nearby context labels such as "Address",
"Street", or "Mailing Address".

```ts
const redactor = createRedactor({
  rules: { address: { action: "redact" } },
});

redactor.redact("Mailing Address: 123 Main Street");
// "Mailing Address: [ADDRESS_1]"
```

- **ID**: `address`
- **Entity type**: `address`
- **Context required**: Yes (labels: Address, Street, Home Address, Mailing Address, Residence, Postal Address)
- **Stream supported**: Yes (maxMatchLength: 120)
- **Validation**: Context label presence, street suffix matching (St, Ave, Rd, Blvd, Lane, Dr, Ct, Pl, Sq, Ter, Cir, Way, Pkwy, Hwy)

## postal_code

Detects postal codes in various international formats (US ZIP, UK postcode,
Canadian postal code, generic 4-digit). Context-optional.

```ts
const redactor = createRedactor({
  rules: { postal_code: { action: "redact" } },
});

redactor.redact("ZIP: 90210-1234");
// "ZIP: [POSTAL_CODE_1]"
```

- **ID**: `postal_code`
- **Entity type**: `postal_code`
- **Context required**: No
- **Stream supported**: Yes (maxMatchLength: 10)
- **Validation**: Format (US ZIP, UK postcode, Canadian postal code, or 4-digit numeric)
