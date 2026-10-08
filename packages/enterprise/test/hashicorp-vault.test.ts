import { beforeEach, describe, expect, it, mock } from "bun:test";
import { HashiCorpVaultProvider } from "../src/providers/hashicorp-vault";

const VAULT_URL = "http://localhost:8200";
const TOKEN = "test-token";
const KEY_NAME = "test-key";

function createMockClient() {
  const writeCall = mock(
    async (
      path: string,
      data: Record<string, unknown>,
    ): Promise<{ data: { ciphertext?: string; plaintext?: string } }> => {
      if (path.includes("/encrypt/")) {
        const pt = data.plaintext as string;
        return {
          data: { ciphertext: `vault:${pt}` },
        };
      }

      if (path.includes("/decrypt/")) {
        const ct = data.ciphertext as string;
        return {
          data: { plaintext: ct.replace(/^vault:/, "") },
        };
      }

      return { data: {} };
    },
  );

  return { write: writeCall };
}

function registerMock(client: ReturnType<typeof createMockClient>) {
  return mock.module("node-vault", () => {
    const factory = (_opts: Record<string, unknown>) => {
      return { write: client.write };
    };

    return { default: factory };
  });
}

describe("HashiCorpVaultProvider", () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(async () => {
    client = createMockClient();
    await registerMock(client);
  });

  it("round-trips plaintext through encrypt and decrypt", async () => {
    const provider = new HashiCorpVaultProvider({
      vaultUrl: VAULT_URL,
      token: TOKEN,
      keyName: KEY_NAME,
    });

    const plaintext = "hello vault";
    const ciphertext = await provider.encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);

    const decrypted = await provider.decrypt(ciphertext);

    expect(decrypted).toBe(plaintext);
  });

  it("uses default mountPath 'transit'", async () => {
    const provider = new HashiCorpVaultProvider({
      vaultUrl: VAULT_URL,
      token: TOKEN,
      keyName: KEY_NAME,
    });

    await provider.encrypt("test");

    expect(client.write.mock.calls[0][0]).toBe(`transit/encrypt/${KEY_NAME}`);
  });

  it("uses custom mountPath when provided", async () => {
    const provider = new HashiCorpVaultProvider({
      vaultUrl: VAULT_URL,
      token: TOKEN,
      keyName: KEY_NAME,
      mountPath: "custom-transit",
    });

    await provider.encrypt("test");

    expect(client.write.mock.calls[0][0]).toBe(
      `custom-transit/encrypt/${KEY_NAME}`,
    );
  });

  it("base64-encodes plaintext before sending to Vault", async () => {
    const provider = new HashiCorpVaultProvider({
      vaultUrl: VAULT_URL,
      token: TOKEN,
      keyName: KEY_NAME,
    });

    await provider.encrypt("hello vault");

    const sentPlaintext = client.write.mock.calls[0][1].plaintext as string;

    expect(Buffer.from(sentPlaintext, "base64").toString("utf8")).toBe(
      "hello vault",
    );
  });

  it("wraps empty-ciphertext errors as VAULT_ENCRYPT_FAILED", async () => {
    const emptyClient = createMockClient();
    emptyClient.write.mockImplementation(async () => ({ data: {} }));
    await registerMock(emptyClient);

    const provider = new HashiCorpVaultProvider({
      vaultUrl: VAULT_URL,
      token: TOKEN,
      keyName: KEY_NAME,
    });

    await expect(provider.encrypt("test")).rejects.toMatchObject({
      code: "VAULT_ENCRYPT_FAILED",
    });
  });

  it("wraps empty-plaintext errors as VAULT_DECRYPT_FAILED", async () => {
    const emptyClient = createMockClient();
    emptyClient.write.mockImplementation(async () => ({ data: {} }));
    await registerMock(emptyClient);

    const provider = new HashiCorpVaultProvider({
      vaultUrl: VAULT_URL,
      token: TOKEN,
      keyName: KEY_NAME,
    });

    await expect(provider.decrypt("vault:test")).rejects.toMatchObject({
      code: "VAULT_DECRYPT_FAILED",
    });
  });

  it("generateDataKey returns 32-byte DEK and encrypted DEK", async () => {
    const provider = new HashiCorpVaultProvider({
      vaultUrl: VAULT_URL,
      token: TOKEN,
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
