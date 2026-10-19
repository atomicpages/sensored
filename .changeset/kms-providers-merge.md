---
"sensored": minor
---

Add cloud KMS vault providers, formerly the separate `@sensored/enterprise`
package (now MIT-licensed like the rest of sensored). Import them from
`sensored/vault/kms/*`:

- `sensored/vault/kms` — barrel re-exporting all providers
- `sensored/vault/kms/aws` — `AwsKmsProvider` (AWS KMS, native data-key API)
- `sensored/vault/kms/gcp` — `GcpKmsProvider` (Google Cloud KMS)
- `sensored/vault/kms/azure` — `AzureKeyVaultProvider` (Azure Key Vault)
- `sensored/vault/kms/hashicorp` — `HashiCorpVaultProvider` (Vault transit)
- `sensored/vault/kms/workos` — `WorkOsEkmProvider` (WorkOS EKM)

All cloud SDKs remain optional peer dependencies, lazy-loaded at runtime.
If you used `@sensored/enterprise`, install `sensored` and swap the import
specifier — the provider classes and options are unchanged.
