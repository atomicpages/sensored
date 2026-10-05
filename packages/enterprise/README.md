# @sensored/enterprise

Cloud KMS vault providers for
[sensored](https://www.npmjs.com/package/sensored).

> **Commercial license.** This package ships under a commercial EULA, not MIT. A
> 30-day evaluation period is granted on the honor system. See
> [LICENSE.md](./LICENSE.md) for full terms.

## Install

```bash
bun add @sensored/enterprise
# or
npm install @sensored/enterprise
```

Cloud SDKs are optional peer dependencies — install only the one(s) you use:

```bash
bun add @aws-sdk/client-kms        # AWS KMS
bun add @google-cloud/kms          # GCP KMS
bun add @azure/keyvault-keys @azure/identity  # Azure Key Vault
bun add node-vault                 # HashiCorp Vault
bun add @workos-inc/node           # WorkOS EKM
```

## Supported providers

| Provider        | Export path                          | SDK                                       |
| --------------- | ------------------------------------ | ----------------------------------------- |
| AWS KMS         | `@sensored/enterprise/kms/aws`       | `@aws-sdk/client-kms`                     |
| GCP KMS         | `@sensored/enterprise/kms/gcp`       | `@google-cloud/kms`                       |
| Azure Key Vault | `@sensored/enterprise/kms/azure`     | `@azure/keyvault-keys`, `@azure/identity` |
| HashiCorp Vault | `@sensored/enterprise/kms/hashicorp` | `node-vault`                              |
| WorkOS EKM      | `@sensored/enterprise/kms/workos`    | `@workos-inc/node`                        |

## Quick start

Pass any enterprise provider to `createEncryptedSession` from `sensored/vault`:

```ts
import { createEncryptedSession } from "sensored/vault";
import { AwsKmsProvider } from "@sensored/enterprise/kms/aws";

const provider = new AwsKmsProvider({
  keyId: process.env.AWS_KMS_KEY_ID!,
  region: process.env.AWS_REGION,
});

const session = await createEncryptedSession({
  provider,
  redactorConfig: { presets: ["pii"], rules: {} },
});

session.redact("Email john@example.com"); // "Email [EMAIL_1]"

const sealed = await session.seal(); // base64 blob — safe to store
session.dispose(); // zeroes the DEK from memory
```

## Providers

### AWS KMS

Uses native `GenerateDataKey` for envelope encryption.

```ts
import { AwsKmsProvider } from "@sensored/enterprise/kms/aws";

const provider = new AwsKmsProvider({
  keyId: "arn:aws:kms:us-east-1:123456789012:key/abc123",
  region: "us-east-1", // optional, defaults to AWS_SDK_REGION
  credentials: {
    // optional, defaults to IAM role
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN, // optional
  },
});
```

### GCP KMS

```ts
import { GcpKmsProvider } from "@sensored/enterprise/kms/gcp";

const provider = new GcpKmsProvider({
  keyName:
    "projects/my-project/locations/global/keyRings/my-ring/cryptoKeys/my-key",
  credentialsJson: process.env.GCP_SERVICE_ACCOUNT_JSON, // optional
});
```

### Azure Key Vault

```ts
import { AzureKeyVaultProvider } from "@sensored/enterprise/kms/azure";

const provider = new AzureKeyVaultProvider({
  vaultUrl: "https://my-vault.vault.azure.net",
  keyName: "my-key",
  credential: undefined, // optional, defaults to DefaultAzureCredential
});
```

### HashiCorp Vault

Uses the Transit secrets engine.

```ts
import { HashiCorpVaultProvider } from "@sensored/enterprise/kms/hashicorp";

const provider = new HashiCorpVaultProvider({
  vaultUrl: "https://vault.example.com:8200",
  token: process.env.VAULT_TOKEN!,
  keyName: "my-key",
  mountPath: "transit", // optional, defaults to "transit"
});
```

### WorkOS EKM

```ts
import { WorkOsEkmProvider } from "@sensored/enterprise/kms/workos";

const provider = new WorkOsEkmProvider({
  apiKey: process.env.WORKOS_API_KEY!,
  ekmId: "ekm_abc123",
  keyId: "key_xyz789",
});
```

## License

See [LICENSE.md](./LICENSE.md). This package is **not** MIT licensed.
