export {
  LocalVaultProvider,
  type LocalVaultProviderOptions,
} from "./local-provider";
export { open, seal } from "./seal";
export { createEncryptedSession } from "./session";
export {
  type EncryptedSession,
  SEALED_BLOB_VERSION,
  type SealedBlob,
  type SealedBlobMetadata,
  type VaultConfig,
  VaultError,
  type VaultErrorCode,
  type VaultProvider,
} from "./types";
