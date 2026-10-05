import { hkdfSync, randomBytes } from "node:crypto";
import { aesGcmDecrypt, aesGcmEncrypt, IV_LENGTH, TAG_LENGTH } from "./aes";
import { generateDek } from "./dek";
import type { VaultProvider } from "./types";
import { VaultError } from "./types";

const MASTER_KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const KDF_INFO = "sensored-vault-v1";

export interface LocalVaultProviderOptions {
  readonly key?: Buffer;
  readonly passphrase?: string;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return Buffer.from(
    hkdfSync("sha256", passphrase, salt, KDF_INFO, MASTER_KEY_LENGTH),
  );
}

export class LocalVaultProvider implements VaultProvider {
  readonly name = "local";
  private readonly key: Buffer;
  private readonly passphrase?: string;
  private readonly salt: Buffer;

  constructor(options: LocalVaultProviderOptions) {
    if (options.key) {
      if (options.key.length !== MASTER_KEY_LENGTH) {
        throw new VaultError("VAULT_INVALID_KEY");
      }

      this.key = options.key;
      this.salt = Buffer.alloc(0);
    } else if (options.passphrase) {
      this.passphrase = options.passphrase;
      this.salt = randomBytes(SALT_LENGTH);
      this.key = deriveKey(options.passphrase, this.salt);
    } else {
      throw new VaultError("VAULT_INVALID_KEY");
    }
  }

  async encrypt(plaintext: string): Promise<string> {
    try {
      const data = aesGcmEncrypt(Buffer.from(plaintext, "utf8"), this.key);

      if (this.passphrase) {
        return Buffer.concat([this.salt, data]).toString("base64");
      }

      return data.toString("base64");
    } catch (e) {
      throw new VaultError("VAULT_ENCRYPT_FAILED", e);
    }
  }

  async decrypt(ciphertext: string): Promise<string> {
    try {
      const raw = Buffer.from(ciphertext, "base64");

      if (this.passphrase) {
        if (raw.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
          throw new Error("Ciphertext too short for salt-prefixed data");
        }

        const salt = raw.subarray(0, SALT_LENGTH);
        const key = deriveKey(this.passphrase, salt);
        const data = raw.subarray(SALT_LENGTH);

        return aesGcmDecrypt(data, key).toString("utf8");
      }

      return aesGcmDecrypt(raw, this.key).toString("utf8");
    } catch (e) {
      if (e instanceof VaultError) {
        throw e;
      }

      throw new VaultError("VAULT_DECRYPT_FAILED", e);
    }
  }

  async generateDataKey(): Promise<{ plaintext: string; encrypted: string }> {
    try {
      const dek = generateDek();
      const encryptedDek = aesGcmEncrypt(dek, this.key);

      if (this.passphrase) {
        const output = Buffer.concat([this.salt, encryptedDek]);

        return {
          plaintext: dek.toString("base64"),
          encrypted: output.toString("base64"),
        };
      }

      return {
        plaintext: dek.toString("base64"),
        encrypted: encryptedDek.toString("base64"),
      };
    } catch (e) {
      if (e instanceof VaultError) {
        throw e;
      }
      throw new VaultError("VAULT_DEK_GENERATION_FAILED", e);
    }
  }

  async decryptDataKey(encrypted: string): Promise<string> {
    try {
      const raw = Buffer.from(encrypted, "base64");

      if (this.passphrase) {
        if (raw.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
          throw new Error("Encrypted DEK too short for salt-prefixed data");
        }

        const salt = raw.subarray(0, SALT_LENGTH);
        const key = deriveKey(this.passphrase, salt);
        const data = raw.subarray(SALT_LENGTH);
        const dek = aesGcmDecrypt(data, key);

        return dek.toString("base64");
      }

      const dek = aesGcmDecrypt(raw, this.key);
      return dek.toString("base64");
    } catch (e) {
      if (e instanceof VaultError) {
        throw e;
      }
      throw new VaultError("VAULT_DEK_DECRYPT_FAILED", e);
    }
  }
}
