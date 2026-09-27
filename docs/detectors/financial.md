# Financial Detectors

## payment_card

Detects payment card numbers (13–19 digits) with Luhn checksum validation.
Supports single-separator group formats and rejects substrings of longer digit
sequences.

```ts
const redactor = createRedactor({
  rules: { payment_card: { action: "redact" } },
});

redactor.redact("Card: 4532-1234-5678-9012");
// "Card: [PAYMENT_CARD_1]"
```

- **ID**: `payment_card`
- **Entity type**: `payment_card`
- **Context required**: No
- **Stream supported**: Yes
- **Validation**: Luhn checksum, length (13–19 digits), separator format

## iban

Detects IBANs for SEPA countries using a country-length map and mod-97 checksum
validation (via BigInt).

```ts
const redactor = createRedactor({
  rules: { iban: { action: "redact" } },
});

redactor.redact("IBAN: GB82 WEST 1234 5698 7654 32");
// "IBAN: [IBAN_1]"
```

- **ID**: `iban`
- **Entity type**: `iban`
- **Context required**: No
- **Stream supported**: Yes (maxMatchLength: 38)
- **Validation**: Country-specific length, mod-97 checksum

## eu_vat

Detects EU VAT numbers for DE (format only), FR (Luhn on SIREN), IT (Luhn), ES
(mod-23 letter check), and NL (mod-11 weighted sum).

```ts
const redactor = createRedactor({
  rules: { eu_vat: { action: "redact" } },
});

redactor.redact("VAT: DE123456789");
// "VAT: [EU_VAT_1]"
```

- **ID**: `eu_vat`
- **Entity type**: `eu_vat`
- **Context required**: No
- **Stream supported**: Yes (maxMatchLength: 15)
- **Validation**: Country-specific checksum (Luhn, mod-23, or mod-11)

## swift_bic

Detects SWIFT/BIC codes (8 or 11 characters: bank code + country + location +
optional branch).

```ts
const redactor = createRedactor({
  rules: { swift_bic: { action: "redact" } },
});

redactor.redact("BIC: DEUTDEFF500");
// "BIC: [SWIFT_BIC_1]"
```

- **ID**: `swift_bic`
- **Entity type**: `swift_bic`
- **Context required**: Yes (labels: BIC, SWIFT, Bank, Payment)
- **Stream supported**: Yes
- **Validation**: Format (8 or 11 chars, valid bank code, country, location)

## uk_sort_code

Detects UK bank sort codes (6 digits, hyphenated or spaced formats).

```ts
const redactor = createRedactor({
  rules: { uk_sort_code: { action: "redact" } },
});

redactor.redact("Sort code: 12-34-56");
// "Sort code: [UK_SORT_CODE_1]"
```

- **ID**: `uk_sort_code`
- **Entity type**: `uk_sort_code`
- **Context required**: Yes (labels: Sort, Branch, Bank)
- **Stream supported**: Yes
- **Validation**: 6-digit format with hyphen or space separators

## us_routing

Detects US ABA routing numbers (9 digits with specific prefix ranges).

```ts
const redactor = createRedactor({
  rules: { us_routing: { action: "redact" } },
});

redactor.redact("Routing: 021000021");
// "Routing: [US_ROUTING_1]"
```

- **ID**: `us_routing`
- **Entity type**: `us_routing`
- **Context required**: Yes (labels: Routing, ABA, ACH, Bank)
- **Stream supported**: Yes
- **Validation**: 9 digits, prefix range check (0-1, 1-2, 2-1, 2-2), checksum validation

## uk_bank_account

Detects UK bank account numbers (6–8 digits).

```ts
const redactor = createRedactor({
  rules: { uk_bank_account: { action: "redact" } },
});

redactor.redact("Account: 12345678");
// "Account: [UK_BANK_ACCOUNT_1]"
```

- **ID**: `uk_bank_account`
- **Entity type**: `uk_bank_account`
- **Context required**: Yes (labels: Account, Bank, Building Society)
- **Stream supported**: Yes
- **Validation**: 6–8 digit format

## card_data

Detects card data tokens including magnetic stripe tracks, CVV/CVC codes, and
expiry dates. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { card_data: { action: "redact" } },
});

redactor.redact("CVV: 123");
// "CVV: [CARD_DATA_1]"
```

- **ID**: `card_data`
- **Entity type**: `card_data`
- **Context required**: Yes (labels: Card, Payment, Credit, Debit, Visa, Mastercard, Amex, CVV, CVC, Expiry, Track, Magnetic, Stripe)
- **Stream supported**: Yes (maxMatchLength: 100)
- **Validation**: Context label presence

## financial_reference

Detects financial reference numbers such as transaction IDs, wire transfer
references, statement numbers, and payment references. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { financial_reference: { action: "redact" } },
});

redactor.redact("Transaction ID: TXN12345678");
// "Transaction ID: [FINANCIAL_REFERENCE_1]"
```

- **ID**: `financial_reference`
- **Entity type**: `financial_reference`
- **Context required**: Yes (labels: Transaction, TXN, Wire, Transfer, Remittance, Statement, Payment, Financial, Banking)
- **Stream supported**: Yes (maxMatchLength: 30)
- **Validation**: Context label presence

## investment_account

Detects investment account numbers including ISA, SIPP, pension, 401K, IRA,
trading, brokerage, loan, and mortgage accounts. Requires nearby context
labels.

```ts
const redactor = createRedactor({
  rules: { investment_account: { action: "redact" } },
});

redactor.redact("ISA Account No: INV123456");
// "ISA Account No: [INVESTMENT_ACCOUNT_1]"
```

- **ID**: `investment_account`
- **Entity type**: `investment_account`
- **Context required**: Yes (labels: ISA, SIPP, Invest, Pension, 401K, IRA, Account, Fund, Trading, Brokerage, Stock, Loan, Mortgage, Credit)
- **Stream supported**: Yes (maxMatchLength: 30)
- **Validation**: Context label presence

## payment_gateway_id

Detects payment gateway IDs such as Stripe tokens, customer IDs, subscription
IDs, merchant IDs, and terminal IDs. Requires nearby context labels.

```ts
const redactor = createRedactor({
  rules: { payment_gateway_id: { action: "redact" } },
});

redactor.redact("Customer ID: cus_abc123def456");
// "Customer ID: [PAYMENT_GATEWAY_ID_1]"
```

- **ID**: `payment_gateway_id`
- **Entity type**: `payment_gateway_id`
- **Context required**: Yes (labels: Stripe, Payment, Gateway, Token, Customer, Subscription, Merchant, Terminal, POS)
- **Stream supported**: Yes (maxMatchLength: 50)
- **Validation**: Context label presence
