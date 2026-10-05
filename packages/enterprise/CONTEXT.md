# Enterprise package

Commercial `@sensored/enterprise` — cloud KMS vault providers for sensored.
Ships on npm under a commercial EULA (not MIT). Honor-system 30-day trial. No
runtime gates; enforcement is legal only.

## Module structure

```
src/
  index.ts                        Barrel exports
  providers/
    base.ts                       BaseKmsProvider<T> abstract base class
    aws-kms.ts                    AwsKmsProvider
    gcp-kms.ts                    GcpKmsProvider
    azure-key-vault.ts            AzureKeyVaultProvider
    hashicorp-vault.ts            HashiCorpVaultProvider
    workos-ekm.ts                 WorkOsEkmProvider
```

## Design

### BaseKmsProvider<T>

Abstract base class implementing `VaultProvider` from `sensored/vault`. Generic
`T` is the cloud SDK client type — eliminates `client: unknown`.

Template method pattern: providers implement `encryptRaw()` / `decryptRaw()`
(protected abstract). The base class provides concrete `encrypt()` / `decrypt()`
that wrap calls in try/catch and rethrow non-`VaultError` exceptions as
`VaultError` with appropriate codes (`VAULT_ENCRYPT_FAILED`,
`VAULT_DECRYPT_FAILED`).

Provides:

- `getClient()` — lazy init via abstract `createClient()`, caches client
- `encrypt()` / `decrypt()` — concrete, wrap `encryptRaw()` / `decryptRaw()`
- `generateDataKey()` — generates 32-byte DEK locally, encrypts via `encrypt()`
- `decryptDataKey()` — delegates to `decrypt()`

Providers override `generateDataKey()` / `decryptDataKey()` only when the cloud
KMS has a native data-key API (AWS KMS `GenerateDataKey`). AWS overrides include
their own try/catch wrapping with `VAULT_DEK_GENERATION_FAILED` /
`VAULT_DEK_DECRYPT_FAILED` codes.

Each provider defines a minimal client interface matching the SDK methods it
uses. SDKs are lazy-loaded via `await import()` with no hard dependencies. All
cloud SDKs are optional peer deps.

### Providers

- **AwsKmsProvider** — overrides `generateDataKey()` and `decryptDataKey()` to
  use native KMS `GenerateDataKey` API. Options: `keyId`, `region`,
  `credentials`.
- **GcpKmsProvider** — uses base defaults. Options: `keyName`,
  `credentialsJson`.
- **AzureKeyVaultProvider** — uses base defaults. Options: `vaultUrl`,
  `keyName`, `credential`.
- **HashiCorpVaultProvider** — uses base defaults. Stores `vaultUrl` and `token`
  as separate fields (not packed into client). Options: `vaultUrl`, `token`,
  `keyName`, `mountPath`.
- **WorkOsEkmProvider** — uses base defaults. Options: `apiKey`, `ekmId`,
  `keyId`.

## Dependencies

`sensored/vault` is the only hard dependency (workspace link). All cloud SDKs
are optional peer deps, lazy-loaded at runtime.
