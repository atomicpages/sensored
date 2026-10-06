import { beforeAll, describe, expect, it, mock } from "bun:test";
import { GcpKmsProvider } from "../src/providers/gcp-kms";

const KEY_NAME =
  "projects/test-project/locations/global/keyRings/test-ring/cryptoKeys/test-key";

function createMockClient() {
  const encryptCall = mock(
    async (_req: { name: string; plaintext: Buffer }) => {
      return [{ ciphertext: Buffer.from(`enc:${_req.plaintext.toString()}`) }];
    },
  );

  const decryptCall = mock(
    async (_req: { name: string; ciphertext: Buffer }) => {
      const ct = _req.ciphertext.toString();
      return [{ plaintext: Buffer.from(ct.replace(/^enc:/, "")) }];
    },
  );

  return { encrypt: encryptCall, decrypt: decryptCall };
}

describe("GcpKmsProvider", () => {
  let client: ReturnType<typeof createMockClient>;

  beforeAll(() => {
    client = createMockClient();

    mock.module("@google-cloud/kms", () => {
      class KeyManagementServiceClient {
        constructor(_opts?: unknown) {}
        encrypt = client.encrypt;
        decrypt = client.decrypt;
      }

      return { KeyManagementServiceClient };
    });
  });

  it("round-trips plaintext through encrypt and decrypt", async () => {
    const provider = new GcpKmsProvider({ keyName: KEY_NAME });
    const plaintext = "hello gcp";
    const ciphertext = await provider.encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);

    const decrypted = await provider.decrypt(ciphertext);

    expect(decrypted).toBe(plaintext);
  });

  it("passes the keyName to encrypt", async () => {
    client.encrypt.mockClear();

    const provider = new GcpKmsProvider({ keyName: KEY_NAME });
    await provider.encrypt("test");

    expect(client.encrypt).toHaveBeenCalledTimes(1);
    expect(client.encrypt.mock.calls[0][0].name).toBe(KEY_NAME);
  });

  it("passes the keyName to decrypt", async () => {
    client.decrypt.mockClear();

    const provider = new GcpKmsProvider({ keyName: KEY_NAME });
    const ciphertext = await provider.encrypt("test");
    await provider.decrypt(ciphertext);

    expect(client.decrypt).toHaveBeenCalledTimes(1);
    expect(client.decrypt.mock.calls[0][0].name).toBe(KEY_NAME);
  });

  it("returns base64-encoded ciphertext", async () => {
    const provider = new GcpKmsProvider({ keyName: KEY_NAME });
    const ciphertext = await provider.encrypt("test");

    expect(() => Buffer.from(ciphertext, "base64")).not.toThrow();
  });

  it("wraps empty-ciphertext errors as VAULT_ENCRYPT_FAILED", async () => {
    const emptyClient = createMockClient();
    emptyClient.encrypt.mockImplementation(async () => [{ ciphertext: null }]);

    mock.module("@google-cloud/kms", () => {
      class KeyManagementServiceClient {
        constructor(_opts?: unknown) {}
        encrypt = emptyClient.encrypt;
        decrypt = emptyClient.decrypt;
      }

      return { KeyManagementServiceClient };
    });

    const provider = new GcpKmsProvider({ keyName: KEY_NAME });

    await expect(provider.encrypt("test")).rejects.toMatchObject({
      code: "VAULT_ENCRYPT_FAILED",
    });
  });

  it("wraps empty-plaintext errors as VAULT_DECRYPT_FAILED", async () => {
    const emptyClient = createMockClient();
    emptyClient.decrypt.mockImplementation(async () => [{ plaintext: null }]);

    mock.module("@google-cloud/kms", () => {
      class KeyManagementServiceClient {
        constructor(_opts?: unknown) {}
        encrypt = emptyClient.encrypt;
        decrypt = emptyClient.decrypt;
      }

      return { KeyManagementServiceClient };
    });

    const provider = new GcpKmsProvider({ keyName: KEY_NAME });
    const ciphertext = await provider.encrypt("test");

    await expect(provider.decrypt(ciphertext)).rejects.toMatchObject({
      code: "VAULT_DECRYPT_FAILED",
    });
  });

  it("generateDataKey returns 32-byte DEK and encrypted DEK", async () => {
    const roundTripClient = createMockClient();

    mock.module("@google-cloud/kms", () => {
      class KeyManagementServiceClient {
        constructor(_opts?: unknown) {}
        encrypt = roundTripClient.encrypt;
        decrypt = roundTripClient.decrypt;
      }

      return { KeyManagementServiceClient };
    });

    const provider = new GcpKmsProvider({ keyName: KEY_NAME });
    const { plaintext, encrypted } = await provider.generateDataKey();

    const decoded = Buffer.from(plaintext, "base64");

    expect(decoded.length).toBe(32);
    expect(encrypted).not.toBe(plaintext);

    const decrypted = await provider.decryptDataKey(encrypted);

    expect(decrypted).toBe(plaintext);
  });
});
