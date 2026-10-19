import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { AzureKeyVaultProvider } from "../../../src/vault/kms/azure-key-vault";

const VAULT_URL = "https://test-vault.vault.azure.net";
const KEY_NAME = "test-key";

function createMockCryptoClient() {
  const encryptCall = mock(
    async (_req: {
      algorithm: string;
      plaintext: Buffer;
    }): Promise<{ result: Buffer | null }> => {
      return { result: Buffer.from(`enc:${_req.plaintext.toString()}`) };
    },
  );

  const decryptCall = mock(
    async (_req: {
      algorithm: string;
      ciphertext: Buffer;
    }): Promise<{ result: Buffer | null }> => {
      const ct = _req.ciphertext.toString();
      return { result: Buffer.from(ct.replace(/^enc:/, "")) };
    },
  );

  return { encrypt: encryptCall, decrypt: decryptCall };
}

describe("AzureKeyVaultProvider", () => {
  let cryptoClient: ReturnType<typeof createMockCryptoClient>;

  beforeAll(() => {
    mock.module("@azure/identity", () => {
      class DefaultAzureCredential {}

      return { DefaultAzureCredential };
    });

    mock.module("@azure/keyvault-keys", () => {
      class KeyClient {
        constructor(_url: string, _cred: unknown) {}
        async getKey(_name: string) {
          return { id: `${VAULT_URL}/keys/${KEY_NAME}` };
        }
      }

      class CryptographyClient {
        constructor(_key: unknown, _cred: unknown) {}
        encrypt = cryptoClient.encrypt;
        decrypt = cryptoClient.decrypt;
      }

      return { KeyClient, CryptographyClient };
    });
  });

  beforeEach(() => {
    cryptoClient = createMockCryptoClient();
  });

  it("round-trips plaintext through encrypt and decrypt", async () => {
    const provider = new AzureKeyVaultProvider({
      vaultUrl: VAULT_URL,
      keyName: KEY_NAME,
    });

    const plaintext = "hello azure";
    const ciphertext = await provider.encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);

    const decrypted = await provider.decrypt(ciphertext);

    expect(decrypted).toBe(plaintext);
  });

  it("uses RSA-OAEP-256 algorithm", async () => {
    const provider = new AzureKeyVaultProvider({
      vaultUrl: VAULT_URL,
      keyName: KEY_NAME,
    });

    await provider.encrypt("test");

    expect(cryptoClient.encrypt.mock.calls[0]?.[0].algorithm).toBe(
      "RSA-OAEP-256",
    );
  });

  it("returns base64-encoded ciphertext", async () => {
    const provider = new AzureKeyVaultProvider({
      vaultUrl: VAULT_URL,
      keyName: KEY_NAME,
    });

    const ciphertext = await provider.encrypt("test");

    expect(() => Buffer.from(ciphertext, "base64")).not.toThrow();
  });

  it("wraps empty-result errors as VAULT_ENCRYPT_FAILED", async () => {
    cryptoClient.encrypt.mockImplementation(async () => ({ result: null }));

    const provider = new AzureKeyVaultProvider({
      vaultUrl: VAULT_URL,
      keyName: KEY_NAME,
    });

    await expect(provider.encrypt("test")).rejects.toMatchObject({
      code: "VAULT_ENCRYPT_FAILED",
    });
  });

  it("wraps empty-result errors as VAULT_DECRYPT_FAILED", async () => {
    cryptoClient.decrypt.mockImplementation(async () => ({ result: null }));

    const provider = new AzureKeyVaultProvider({
      vaultUrl: VAULT_URL,
      keyName: KEY_NAME,
    });

    const ciphertext = await provider.encrypt("test");

    await expect(provider.decrypt(ciphertext)).rejects.toMatchObject({
      code: "VAULT_DECRYPT_FAILED",
    });
  });

  it("generateDataKey returns 32-byte DEK and encrypted DEK", async () => {
    const provider = new AzureKeyVaultProvider({
      vaultUrl: VAULT_URL,
      keyName: KEY_NAME,
    });

    const { plaintext, encrypted } = await provider.generateDataKey();

    const decoded = Buffer.from(plaintext, "base64");

    expect(decoded.length).toBe(32);
    expect(encrypted).not.toBe(plaintext);

    const decrypted = await provider.decryptDataKey(encrypted);

    expect(decrypted).toBe(plaintext);
  });
});
