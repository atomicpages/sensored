# Vault

The vault provides encrypted persistence for restoration maps, enabling secure
storage of PII mappings across process boundaries. It also offers in-memory
encryption for sessions that need to keep restoration maps protected at rest.

## Why vault?

The standard `RestorationMap` stores plaintext PII mappings (placeholder to
original value). If an attacker gains access to memory or a serialized map,
all original values are exposed. The vault encrypts these mappings using
AES-256-GCM with envelope encryption, so plaintext PII never sits in memory
unprotected and serialized maps are safe to persist.

## VaultProvider

```ts
interface VaultProvider {
  readonly name: string;
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
  generateDataKey(): Promise<{ plaintext: string; encrypted: string }>;
  decryptDataKey(encrypted: string): Promise<string>;
}
```

The `VaultProvider` interface defines four methods for envelope encryption:

- **`generateDataKey()`** — Creates a random 32-byte data encryption key (DEK)
  and returns both its plaintext (base64) and an encrypted copy wrapped by the
  provider's master key.
- **`decryptDataKey()`** — Decrypts an encrypted DEK using the provider's
  master key.
- **`encrypt()`** — Encrypts a plaintext string (used for individual map
  entries).
- **`decrypt()`** — Decrypts a ciphertext string.

The MIT-licensed `sensored` package ships `LocalVaultProvider`. Cloud KMS
providers (AWS KMS, GCP KMS, Azure Key Vault, HashiCorp Vault, WorkOS EKM)
are available in the commercial `@sensored/enterprise` package.

## LocalVaultProvider

`LocalVaultProvider` uses AES-256-GCM with a local master key. It supports two
key modes:

### Raw key mode

Provide a 32-byte `Buffer` as the master key:

```ts
import { LocalVaultProvider } from "sensored/vault";
import { randomBytes } from "node:crypto";

const key = randomBytes(32);
const provider = new LocalVaultProvider({ key });
```

The key must be exactly 32 bytes. Store it securely (environment variable,
secrets manager, HSM). Anyone with the key can decrypt all sealed data.

### Passphrase mode

Provide a passphrase string; the provider derives a 32-byte key via HKDF-SHA256
with a random 16-byte salt:

```ts
const provider = new LocalVaultProvider({
  passphrase: process.env.VAULT_PASSPHRASE!,
});
```

The salt is generated per provider instance and embedded as a prefix in all
encrypted output, so you don't need to store it separately. The same passphrase
with a different salt produces a different key — this is by design.

## Encrypted sessions

`createEncryptedSession` wraps a redaction session with in-memory encryption.
The restoration map is stored as encrypted entries (AES-256-GCM with a DEK)
and decrypted on demand for `restore()` and `stream()`:

```ts
import { createEncryptedSession, LocalVaultProvider } from "sensored/vault";
import { randomBytes } from "node:crypto";

const provider = new LocalVaultProvider({ key: randomBytes(32) });

const session = await createEncryptedSession({
  provider,
  redactorConfig: {
    presets: ["pii"],
    rules: {},
  },
});

// Redact as usual — PII is encrypted in memory
const redacted = session.redact("Email john@example.com");
// "Email [EMAIL_1]"

// Restore decrypts on demand
const restored = session.restore("Contact [EMAIL_1]");
// "Contact john@example.com"

// Stream restoration also decrypts on demand
const restorer = session.stream();

// Seal the map for persistence
const sealed = await session.seal();
// Base64-encoded sealed blob — safe to store anywhere

// Dispose to zero the DEK from memory
session.dispose();
```

### Hydration

Pass an existing `RestorationMap` to initialize the encrypted session with
prior data. Each entry is encrypted at creation time:

```ts
const session = await createEncryptedSession({
  provider,
  redactorConfig: { presets: ["pii"], rules: {} },
  existingMap: {
    "[EMAIL_1]": "john@example.com",
  },
});
```

### API

The `EncryptedSession` interface mirrors `Session` with two additions:

| Method | Description |
| --- | --- |
| `redact(text)` | Redacts PII, encrypts new entries in the map |
| `redactMessages(messages)` | Recursively redacts structured messages |
| `restore(text)` | Restores placeholders by decrypting map entries |
| `stream()` | Returns a `StreamRestorer` bound to the decrypted map |
| `reset()` | Clears encrypted entries and reinitializes the redactor |
| `seal()` | Returns a base64-encoded sealed blob of the map |
| `map` | Returns the decrypted restoration map (read-only) |
| `dispose()` | Clears entries and zeroes the DEK from memory |

### detectOnly

Encrypted sessions do not support `detectOnly` mode. Passing a config with
`detectOnly: true` throws a `VaultError`.

## Seal and open

`seal()` and `open()` provide standalone envelope encryption for restoration
maps, independent of session lifecycle:

```ts
import { seal, open, LocalVaultProvider } from "sensored/vault";

const provider = new LocalVaultProvider({ passphrase: "secret" });

// Seal a map into a portable base64 blob
const sealed = await seal(
  { "[EMAIL_1]": "john@example.com" },
  provider,
  { conversationId: "abc-123" }, // optional metadata
);
// "eyJ2ZXJzaW9uIjoxLCJwcm92aWRlciI6ImxvY2FsIi..."

// Open it later (same provider)
const map = await open(sealed, provider);
// { "[EMAIL_1]": "john@example.com" }
```

### Sealed blob format

The sealed blob is a base64-encoded JSON object:

```json
{
  "version": 1,
  "provider": "local",
  "createdAt": "2026-01-15T12:00:00.000Z",
  "encryptedDek": "base64...",
  "encryptedMap": "base64...",
  "metadata": { "conversationId": "abc-123" }
}
```

- **`version`** — Sealed blob format version (currently `1`).
- **`provider`** — Name of the provider that created the blob. `open()` throws
  `VAULT_PROVIDER_MISMATCH` if the provider name doesn't match.
- **`encryptedDek`** — The data encryption key, encrypted by the provider's
  master key.
- **`encryptedMap`** — The JSON-serialized restoration map, encrypted by the
  DEK.
- **`metadata`** — Optional user-provided metadata (string key-value pairs).

### Serialization helpers

`serializeSealedBlob()` and `deserializeSealedBlob()` are exported for
low-level access:

```ts
import { serializeSealedBlob, deserializeSealedBlob } from "sensored/vault";
```

## Error handling

All vault errors extend `VaultError` with a `code` property:

```ts
import { VaultError } from "sensored/vault";

try {
  await open(sealed, wrongProvider);
} catch (e) {
  if (e instanceof VaultError) {
    console.log(e.code); // "VAULT_PROVIDER_MISMATCH"
    console.log(e.message); // "The sealed blob was created with a different vault provider."
  }
}
```

### Error codes

| Code | Description |
| --- | --- |
| `VAULT_ENCRYPT_FAILED` | Encryption operation failed |
| `VAULT_DECRYPT_FAILED` | Decryption operation failed |
| `VAULT_KEY_DERIVATION_FAILED` | HKDF key derivation from passphrase failed |
| `VAULT_INVALID_KEY` | Key is missing or not 32 bytes |
| `VAULT_INVALID_SEALED_BLOB` | Sealed blob is malformed or unsupported version |
| `VAULT_PROVIDER_MISMATCH` | Sealed blob was created with a different provider |
| `VAULT_DEK_GENERATION_FAILED` | DEK generation failed |
| `VAULT_DEK_DECRYPT_FAILED` | DEK decryption failed |

## Enterprise providers

Cloud KMS providers are available in `@sensored/enterprise`:

```ts
import { AwsKmsProvider } from "@sensored/enterprise";

const provider = new AwsKmsProvider({
  keyId: "arn:aws:kms:us-east-1:123456789012:key/abc-def",
  // Optional: override default AWS SDK credentials
  region: "us-east-1",
});
```

Supported providers:

| Provider | Class | Key manager |
| --- | --- | --- |
| AWS KMS | `AwsKmsProvider` | AWS KMS |
| GCP KMS | `GcpKmsProvider` | Google Cloud KMS |
| Azure Key Vault | `AzureKeyVaultProvider` | Azure Key Vault |
| HashiCorp Vault | `HashiCorpVaultProvider` | HashiCorp Vault Transit Engine |
| WorkOS EKM | `WorkosEkmProvider` | WorkOS Enterprise Key Manager |

All cloud SDKs are lazy-loaded with no hard dependencies. Install the
corresponding SDK package only when using that provider.

## Platform requirements

The vault module uses `node:crypto` and requires Node.js 20+ or Bun. It is not
available in browsers or edge runtimes.
