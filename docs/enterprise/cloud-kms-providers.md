# Cloud KMS Providers

The `@sensored/enterprise` package provides cloud KMS providers that implement
the `VaultProvider` interface from `sensored/vault`. These providers use envelope
encryption: a data encryption key (DEK) encrypts restoration maps locally, and
the cloud KMS encrypts the DEK itself.

## Supported providers

| Provider | Class | Key manager |
| --- | --- | --- |
| AWS KMS | `AwsKmsProvider` | AWS KMS |
| GCP KMS | `GcpKmsProvider` | Google Cloud KMS |
| Azure Key Vault | `AzureKeyVaultProvider` | Azure Key Vault |
| HashiCorp Vault | `HashiCorpVaultProvider` | HashiCorp Vault Transit Engine |
| WorkOS EKM | `WorkosEkmProvider` | WorkOS Enterprise Key Manager |

All cloud SDKs are lazy-loaded via `await import()` with no hard dependencies.
Install the corresponding SDK package only when using that provider.

## AWS KMS

```ts
import { AwsKmsProvider } from "@sensored/enterprise";

const provider = new AwsKmsProvider({
  keyId: "arn:aws:kms:us-east-1:123456789012:key/abc-def",
  region: "us-east-1", // optional
  endpoint: "https://kms.us-east-1.amazonaws.com", // optional (VPC endpoints)
});
```

AWS KMS overrides `generateDataKey()` and `decryptDataKey()` to use the native
`GenerateDataKey` API, which returns the DEK both in plaintext and encrypted
form in a single call.

## GCP KMS

```ts
import { GcpKmsProvider } from "@sensored/enterprise";

const provider = new GcpKmsProvider({
  keyName: "projects/my-project/locations/global/keyRings/my-ring/cryptoKeys/my-key",
  credentialsJson: process.env.GCP_CREDENTIALS_JSON, // optional
});
```

## Azure Key Vault

```ts
import { AzureKeyVaultProvider } from "@sensored/enterprise";

const provider = new AzureKeyVaultProvider({
  vaultUrl: "https://my-vault.vault.azure.net",
  keyName: "my-key",
  credential: tokenCredential, // @azure/identity TokenCredential
});
```

## HashiCorp Vault

```ts
import { HashiCorpVaultProvider } from "@sensored/enterprise";

const provider = new HashiCorpVaultProvider({
  vaultUrl: "http://127.0.0.1:8200",
  token: process.env.VAULT_TOKEN,
  keyName: "my-key",
  mountPath: "transit", // optional, defaults to "transit"
});
```

## WorkOS EKM

```ts
import { WorkosEkmProvider } from "@sensored/enterprise";

const provider = new WorkosEkmProvider({
  apiKey: process.env.WORKOS_API_KEY,
  ekmId: "ekm_123456",
  keyId: "key_abcdef",
});
```

## Usage with encrypted sessions

All providers work with `createEncryptedSession` from `sensored/vault`:

```ts
import { createEncryptedSession } from "sensored/vault";
import { AwsKmsProvider } from "@sensored/enterprise";

const provider = new AwsKmsProvider({
  keyId: "arn:aws:kms:us-east-1:123456789012:key/abc-def",
});

const session = await createEncryptedSession({
  provider,
  redactorConfig: {
    presets: ["pii"],
    rules: {},
  },
});

const redacted = session.redact("Email john@example.com");
// "Email [EMAIL_1]"

const sealed = await session.seal();
// Base64 sealed blob — safe to persist

session.dispose();
```

## Error handling

All provider errors extend `VaultError` from `sensored/vault`. The base class
wraps SDK-specific exceptions with appropriate error codes:

| Code | Description |
| --- | --- |
| `VAULT_ENCRYPT_FAILED` | Encryption operation failed |
| `VAULT_DECRYPT_FAILED` | Decryption operation failed |
| `VAULT_DEK_GENERATION_FAILED` | DEK generation failed (AWS KMS) |
| `VAULT_DEK_DECRYPT_FAILED` | DEK decryption failed (AWS KMS) |
