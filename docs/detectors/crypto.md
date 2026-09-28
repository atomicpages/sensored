# Crypto Detectors

## crypto_address

Detects cryptocurrency addresses for Bitcoin, Ethereum, Litecoin, Ripple,
Cardano, Solana, Cosmos, Tezos, BNB Chain, and other networks. Context-optional.

```ts
const redactor = createRedactor({
  rules: { crypto_address: { action: "redact" } },
});

redactor.redact("Send to: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");
// "Send to: [CRYPTO_ADDRESS_1]"
```

- **ID**: `crypto_address`
- **Entity type**: `crypto_address`
- **Context required**: No
- **Stream supported**: Yes (maxMatchLength: 95)
- **Validation**: Format-specific patterns (Bitcoin, Ethereum, Litecoin, Ripple,
  Cardano, Solana, Cosmos, Tezos, BNB Chain)

## crypto_tx_hash

Detects cryptocurrency transaction hashes (64-character hexadecimal strings).
Requires nearby context labels such as "Transaction", "Tx Hash", or "TXID".

```ts
const redactor = createRedactor({
  rules: { crypto_tx_hash: { action: "redact" } },
});

redactor.redact(
  "Tx Hash: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
);
// "Tx Hash: [CRYPTO_TX_HASH_1]"
```

- **ID**: `crypto_tx_hash`
- **Entity type**: `crypto_tx_hash`
- **Context required**: Yes (labels: Transaction, Tx Hash, Transaction ID,
  Transaction Hash, Blockchain Transaction, TXID)
- **Stream supported**: Yes (maxMatchLength: 64)
- **Validation**: Context label presence
