import { randomBytes } from "node:crypto";
import { VaultError, type VaultProvider } from "sensored/vault";

export abstract class BaseKmsProvider<T> implements VaultProvider {
  abstract readonly name: string;
  private _client: T | undefined;

  protected abstract createClient(): Promise<T>;

  protected async getClient(): Promise<T> {
    if (this._client !== undefined) {
      return this._client;
    }

    this._client = await this.createClient();

    return this._client;
  }

  protected abstract encryptRaw(plaintext: string): Promise<string>;

  protected abstract decryptRaw(ciphertext: string): Promise<string>;

  async encrypt(plaintext: string): Promise<string> {
    try {
      return await this.encryptRaw(plaintext);
    } catch (e) {
      if (e instanceof VaultError) {
        throw e;
      }
      throw new VaultError("VAULT_ENCRYPT_FAILED", e);
    }
  }

  async decrypt(ciphertext: string): Promise<string> {
    try {
      return await this.decryptRaw(ciphertext);
    } catch (e) {
      if (e instanceof VaultError) {
        throw e;
      }
      throw new VaultError("VAULT_DECRYPT_FAILED", e);
    }
  }

  async generateDataKey(): Promise<{ plaintext: string; encrypted: string }> {
    try {
      const dek = randomBytes(32);
      const encrypted = await this.encrypt(dek.toString("base64"));

      return {
        plaintext: dek.toString("base64"),
        encrypted,
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
      return await this.decrypt(encrypted);
    } catch (e) {
      if (e instanceof VaultError) {
        throw e;
      }
      throw new VaultError("VAULT_DEK_DECRYPT_FAILED", e);
    }
  }
}
