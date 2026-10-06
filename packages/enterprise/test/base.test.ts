import { describe, expect, it, mock } from "bun:test";
import { VaultError } from "sensored/vault";
import { BaseKmsProvider } from "../src/providers/base";

class StubProvider extends BaseKmsProvider<{ call(): string }> {
  readonly name = "stub";

  createClientCalls = 0;

  protected async createClient(): Promise<{ call(): string }> {
    this.createClientCalls++;

    return { call: () => "ok" };
  }

  protected async encryptRaw(plaintext: string): Promise<string> {
    await this.getClient();
    return `enc:${plaintext}`;
  }

  protected async decryptRaw(ciphertext: string): Promise<string> {
    await this.getClient();
    return ciphertext.replace(/^enc:/, "");
  }
}

class FailingProvider extends BaseKmsProvider<unknown> {
  readonly name = "failing";

  protected async createClient(): Promise<unknown> {
    return {};
  }

  protected async encryptRaw(): Promise<string> {
    throw new Error("encrypt failed");
  }

  protected async decryptRaw(): Promise<string> {
    throw new Error("decrypt failed");
  }
}

class VaultErrorProvider extends BaseKmsProvider<unknown> {
  readonly name = "vault-error";

  protected async createClient(): Promise<unknown> {
    return {};
  }

  protected async encryptRaw(): Promise<string> {
    throw new VaultError("VAULT_ENCRYPT_FAILED");
  }

  protected async decryptRaw(): Promise<string> {
    throw new VaultError("VAULT_DECRYPT_FAILED");
  }
}

class FailingDekProvider extends BaseKmsProvider<unknown> {
  readonly name = "failing-dek";

  protected async createClient(): Promise<unknown> {
    return {};
  }

  protected async encryptRaw(): Promise<string> {
    throw new Error("encrypt failed");
  }

  protected async decryptRaw(): Promise<string> {
    throw new Error("decrypt failed");
  }
}

describe("BaseKmsProvider", () => {
  describe("encrypt and decrypt", () => {
    it("round-trips through encryptRaw and decryptRaw", async () => {
      const provider = new StubProvider();
      const plaintext = "hello world";
      const ciphertext = await provider.encrypt(plaintext);

      expect(ciphertext).toBe("enc:hello world");

      const decrypted = await provider.decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });

    it("encrypt wraps non-VaultError as VAULT_ENCRYPT_FAILED", async () => {
      const provider = new FailingProvider();

      await expect(provider.encrypt("test")).rejects.toThrow(VaultError);
      await expect(provider.encrypt("test")).rejects.toMatchObject({
        code: "VAULT_ENCRYPT_FAILED",
      });
    });

    it("decrypt wraps non-VaultError as VAULT_DECRYPT_FAILED", async () => {
      const provider = new FailingProvider();

      await expect(provider.decrypt("test")).rejects.toThrow(VaultError);
      await expect(provider.decrypt("test")).rejects.toMatchObject({
        code: "VAULT_DECRYPT_FAILED",
      });
    });

    it("encrypt rethrows VaultError as-is", async () => {
      const provider = new VaultErrorProvider();

      await expect(provider.encrypt("test")).rejects.toMatchObject({
        code: "VAULT_ENCRYPT_FAILED",
      });
    });

    it("decrypt rethrows VaultError as-is", async () => {
      const provider = new VaultErrorProvider();

      await expect(provider.decrypt("test")).rejects.toMatchObject({
        code: "VAULT_DECRYPT_FAILED",
      });
    });
  });

  describe("generateDataKey", () => {
    it("returns 32-byte base64 DEK and encrypted DEK", async () => {
      const provider = new StubProvider();
      const { plaintext, encrypted } = await provider.generateDataKey();

      const decoded = Buffer.from(plaintext, "base64");

      expect(decoded.length).toBe(32);
      expect(encrypted).toBe(`enc:${plaintext}`);
    });

    it("decryptDataKey round-trips the encrypted DEK", async () => {
      const provider = new StubProvider();
      const { plaintext, encrypted } = await provider.generateDataKey();
      const decrypted = await provider.decryptDataKey(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("wraps errors as VAULT_ENCRYPT_FAILED (rethrown by generateDataKey)", async () => {
      const provider = new FailingDekProvider();

      await expect(provider.generateDataKey()).rejects.toMatchObject({
        code: "VAULT_ENCRYPT_FAILED",
      });
    });

    it("decryptDataKey wraps errors as VAULT_DECRYPT_FAILED (rethrown by decryptDataKey)", async () => {
      const provider = new FailingDekProvider();

      await expect(provider.decryptDataKey("test")).rejects.toMatchObject({
        code: "VAULT_DECRYPT_FAILED",
      });
    });
  });

  describe("getClient", () => {
    it("caches the client (createClient called once)", async () => {
      const provider = new StubProvider();

      await provider.encrypt("a");
      await provider.encrypt("b");
      await provider.decrypt("enc:c");

      expect(provider.createClientCalls).toBe(1);
    });
  });
});
