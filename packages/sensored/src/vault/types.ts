import type { StreamRestorer } from "../stream-restore";
import { SESSION_BRAND } from "../symbols";
import type { RedactorConfig, RestorationMap } from "../types";

export type VaultErrorCode =
  | "VAULT_ENCRYPT_FAILED"
  | "VAULT_DECRYPT_FAILED"
  | "VAULT_INVALID_KEY"
  | "VAULT_INVALID_SEALED_BLOB"
  | "VAULT_PROVIDER_MISMATCH"
  | "VAULT_DEK_GENERATION_FAILED"
  | "VAULT_DEK_DECRYPT_FAILED";

const vaultErrorMessages: Record<VaultErrorCode, string> = {
  VAULT_ENCRYPT_FAILED: "Vault encryption operation failed.",
  VAULT_DECRYPT_FAILED: "Vault decryption operation failed.",
  VAULT_INVALID_KEY:
    "The provided key is invalid. Expected a 32-byte Buffer or a passphrase string.",
  VAULT_INVALID_SEALED_BLOB:
    "The sealed blob is malformed or has an unsupported version.",
  VAULT_PROVIDER_MISMATCH:
    "The sealed blob was created with a different vault provider.",
  VAULT_DEK_GENERATION_FAILED: "Failed to generate data encryption key.",
  VAULT_DEK_DECRYPT_FAILED: "Failed to decrypt the data encryption key.",
};

export class VaultError extends Error {
  readonly code: VaultErrorCode;
  override readonly cause?: unknown;

  constructor(code: VaultErrorCode, cause?: unknown) {
    super(vaultErrorMessages[code]);
    this.name = "VaultError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export interface VaultProvider {
  readonly name: string;
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
  generateDataKey(): Promise<{ plaintext: string; encrypted: string }>;
  decryptDataKey(encrypted: string): Promise<string>;
}

export interface SealedBlobMetadata extends Readonly<Record<string, string>> {}

export interface SealedBlob {
  readonly version: number;
  readonly provider: string;
  readonly createdAt: string;
  readonly encryptedDek: string;
  readonly encryptedMap: string;
  readonly metadata?: SealedBlobMetadata;
}

export interface VaultConfig {
  readonly provider: VaultProvider;
  readonly redactorConfig: RedactorConfig;
  readonly existingMap?: RestorationMap;
}

export interface EncryptedSession {
  readonly redact: (text: string) => string;
  readonly redactMessages: <
    T extends readonly { role: string; content: unknown }[],
  >(
    messages: T,
  ) => T;
  readonly restore: (text: string) => string;
  readonly stream: () => StreamRestorer;
  readonly reset: () => void;
  readonly seal: () => Promise<string>;
  readonly map: RestorationMap;
  readonly dispose: () => void;
  readonly [SESSION_BRAND]: true;
}

export const SEALED_BLOB_VERSION = 1;
