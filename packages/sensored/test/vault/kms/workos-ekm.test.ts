import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { WorkOsEkmProvider } from "../../../src/vault/kms/workos-ekm";

const API_KEY = "test-api-key";
const EKM_ID = "ekm_123";
const KEY_ID = "key_456";

function createMockClient() {
  const encryptCall = mock(async (data: string, context: unknown) => {
    return `ekm:${data}`;
  });

  const decryptCall = mock(async (encryptedData: string) => {
    return encryptedData.replace(/^ekm:/, "");
  });

  return {
    vault: {
      encrypt: encryptCall,
      decrypt: decryptCall,
    },
  };
}

describe("WorkOsEkmProvider", () => {
  let client: ReturnType<typeof createMockClient>;

  beforeAll(() => {
    mock.module("@workos-inc/node", () => {
      class WorkOS {
        constructor(_apiKey: string) {}

        vault = client.vault;
      }

      return { WorkOS };
    });
  });

  beforeEach(() => {
    client = createMockClient();
  });

  it("round-trips plaintext through encrypt and decrypt", async () => {
    const provider = new WorkOsEkmProvider({
      apiKey: API_KEY,
      ekmId: EKM_ID,
      keyId: KEY_ID,
    });

    const plaintext = "hello workos";
    const ciphertext = await provider.encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);

    const decrypted = await provider.decrypt(ciphertext);

    expect(decrypted).toBe(plaintext);
  });

  it("passes ekmId and keyId in encrypt context", async () => {
    const provider = new WorkOsEkmProvider({
      apiKey: API_KEY,
      ekmId: EKM_ID,
      keyId: KEY_ID,
    });

    await provider.encrypt("test");

    expect(client.vault.encrypt).toHaveBeenCalledTimes(1);
    expect(client.vault.encrypt.mock.calls[0]?.[1]).toEqual({
      ekmId: EKM_ID,
      keyId: KEY_ID,
    });
  });

  it("base64-encodes plaintext before sending to WorkOS", async () => {
    const provider = new WorkOsEkmProvider({
      apiKey: API_KEY,
      ekmId: EKM_ID,
      keyId: KEY_ID,
    });

    await provider.encrypt("hello workos");

    const sentData = client.vault.encrypt.mock.calls[0]?.[0] as string;

    expect(Buffer.from(sentData, "base64").toString("utf8")).toBe(
      "hello workos",
    );
  });

  it("wraps SDK errors as VAULT_ENCRYPT_FAILED", async () => {
    client.vault.encrypt.mockImplementation(async () => {
      throw new Error("encrypt failed");
    });

    const provider = new WorkOsEkmProvider({
      apiKey: API_KEY,
      ekmId: EKM_ID,
      keyId: KEY_ID,
    });

    await expect(provider.encrypt("test")).rejects.toMatchObject({
      code: "VAULT_ENCRYPT_FAILED",
    });
  });

  it("wraps SDK errors as VAULT_DECRYPT_FAILED", async () => {
    client.vault.decrypt.mockImplementation(async () => {
      throw new Error("decrypt failed");
    });

    const provider = new WorkOsEkmProvider({
      apiKey: API_KEY,
      ekmId: EKM_ID,
      keyId: KEY_ID,
    });

    await expect(provider.decrypt("ekm:test")).rejects.toMatchObject({
      code: "VAULT_DECRYPT_FAILED",
    });
  });

  it("generateDataKey returns 32-byte DEK and encrypted DEK", async () => {
    const provider = new WorkOsEkmProvider({
      apiKey: API_KEY,
      ekmId: EKM_ID,
      keyId: KEY_ID,
    });

    const { plaintext, encrypted } = await provider.generateDataKey();

    const decoded = Buffer.from(plaintext, "base64");

    expect(decoded.length).toBe(32);
    expect(encrypted).not.toBe(plaintext);

    const decrypted = await provider.decryptDataKey(encrypted);

    expect(decrypted).toBe(plaintext);
  });
});
