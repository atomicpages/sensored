# Vault

Encrypted persistence for restoration maps and in-memory session encryption.
Uses `node:crypto` (AES-256-GCM) — Node.js 20+ or Bun only.

## Module structure

```
types.ts           VaultProvider interface, EncryptedSession, SealedBlob, VaultError, VaultErrorCode, SEALED_BLOB_VERSION
aes.ts             Shared AES-256-GCM utility: aesGcmEncrypt(), aesGcmDecrypt(), IV_LENGTH, TAG_LENGTH
dek.ts             DEK management: generateDek(), encryptWithDek(), decryptWithDek(), zeroDek(), DEK_LENGTH
local-provider.ts  LocalVaultProvider class + LocalVaultProviderOptions
seal.ts            seal(), open(), serializeSealedBlob(), deserializeSealedBlob() + type guards
session.ts         createEncryptedSession()
index.ts           Barrel exports
```

## Design

### aes.ts

Single source of truth for AES-256-GCM encrypt/decrypt. `aesGcmEncrypt(plaintext, key)`
returns `Buffer(iv || ciphertext || authTag)` with 12-byte IV and 16-byte tag.
`aesGcmDecrypt(data, key)` reverses it. Exports `IV_LENGTH` and `TAG_LENGTH`
for `local-provider.ts` which needs to slice the combined buffer.

### Envelope encryption

A DEK (data encryption key) encrypts data; the provider's master key encrypts
the DEK. `LocalVaultProvider` uses a local key or passphrase-derived key as the
master key. Enterprise providers use cloud KMS.

### VaultProvider interface

Four methods + `name` property: `encrypt()`, `decrypt()`,
`generateDataKey()`, `decryptDataKey()`. The MIT-licensed package ships
`LocalVaultProvider`. Cloud KMS providers live in `@sensored/enterprise`.

### LocalVaultProvider

Accepts `key` (raw 32-byte Buffer, priority) or `passphrase` (string,
HKDF-SHA256 with random 16-byte salt). Salt is embedded as a prefix in
encrypted output. `LocalVaultProviderOptions` is exported from
`local-provider.ts`.

### DEK management

`dek.ts` exports `generateDek()` (returns 32-byte random Buffer),
`encryptWithDek(plaintext, dek)` (delegates to `aesGcmEncrypt`),
`decryptWithDek(ciphertext, dek)` (delegates to `aesGcmDecrypt`), and
`zeroDek(dek)` (fills Buffer with zeros).

### Sealed blob

`SealedBlob` is a JSON object with `version`, `provider`, `createdAt`,
`encryptedDek`, `encryptedMap`, optional `metadata`. Base64-encoded via
`serializeSealedBlob()` / `deserializeSealedBlob()` (internal to `seal.ts`,
not exported from barrel). `SEALED_BLOB_VERSION` is `1`. `open()` throws
`VAULT_PROVIDER_MISMATCH` if the provider name doesn't match. `seal()` accepts
optional `SealedBlobMetadata` (string key-value pairs). Type guards
(`isRestorationMap`, `isSealedBlob`) validate parsed JSON without unsafe
typecasts; both reject arrays.

### EncryptedSession

`createEncryptedSession(config: VaultConfig)` returns `Promise<EncryptedSession>`.
`VaultConfig` has `provider`, `redactorConfig`, optional `existingMap`. The DEK
is fetched async at init, then encrypt/decrypt are sync via `node:crypto`.
The restoration map is stored as base64 strings (via `encryptWithDek`/`decryptWithDek`
from `dek.ts`) in a `Map<string, string>` and decrypted on demand for `restore()`,
`stream()`, and `map` getter. `seal()` returns a base64 sealed blob. `dispose()`
clears entries and zeros the DEK.

### Errors

`VaultError` extends `Error` with `code: VaultErrorCode` and
`override readonly cause?: unknown`. Codes: `VAULT_ENCRYPT_FAILED`,
`VAULT_DECRYPT_FAILED`, `VAULT_INVALID_KEY`,
`VAULT_INVALID_SEALED_BLOB`, `VAULT_PROVIDER_MISMATCH`,
`VAULT_DEK_GENERATION_FAILED`, `VAULT_DEK_DECRYPT_FAILED`.

### Exports

Exported via `sensored/vault` subpath. `package.json` has `"./vault"` export
entry. `tsdown.config.ts` has `src/vault/index.ts` entry. `tsconfig.src.json`
uses `"types": ["bun"]` to provide `Buffer` and `node:crypto` globals.
