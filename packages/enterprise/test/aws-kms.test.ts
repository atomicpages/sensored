import { beforeAll, describe, expect, it } from "bun:test";
import { CreateKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { FakeCloud } from "fakecloud";
import { AwsKmsProvider } from "../src/providers/aws-kms";

const FAKECLOUD_URL = "http://localhost:4533";
const REGION = "us-east-1";

const INTEGRATION = process.env.ENTERPRISE_INTEGRATION === "1";
const describeOrSkip = INTEGRATION ? describe : describe.skip;

describeOrSkip("AwsKmsProvider (integration with fakecloud)", () => {
  let provider: AwsKmsProvider;
  let fc: FakeCloud;
  let keyArn: string;

  beforeAll(async () => {
    fc = new FakeCloud(FAKECLOUD_URL);

    const kmsClient = new KMSClient({
      region: REGION,
      endpoint: FAKECLOUD_URL,
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });

    const result = await kmsClient.send(
      new CreateKeyCommand({ description: "redactme-test-key" }),
    );

    keyArn = result.KeyMetadata!.Arn!;

    provider = new AwsKmsProvider({
      keyId: keyArn,
      region: REGION,
      endpoint: FAKECLOUD_URL,
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });
  });

  describe("encrypt and decrypt", () => {
    it("round-trips plaintext through KMS", async () => {
      const plaintext = "hello world";
      const ciphertext = await provider.encrypt(plaintext);

      expect(ciphertext).not.toBe(plaintext);

      const decrypted = await provider.decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });

    it("returns base64 ciphertext", async () => {
      const ciphertext = await provider.encrypt("test");

      expect(() => Buffer.from(ciphertext, "base64")).not.toThrow();
    });

    it("handles unicode", async () => {
      const plaintext = "héllo 世界 🌍";
      const ciphertext = await provider.encrypt(plaintext);
      const decrypted = await provider.decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("generateDataKey and decryptDataKey", () => {
    it("generates a 32-byte DEK with encrypted counterpart", async () => {
      const { plaintext, encrypted } = await provider.generateDataKey();

      const decoded = Buffer.from(plaintext, "base64");

      expect(decoded.length).toBe(32);
      expect(encrypted).not.toBe(plaintext);
    });

    it("decrypts the data key back to the original", async () => {
      const { plaintext, encrypted } = await provider.generateDataKey();
      const decrypted = await provider.decryptDataKey(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("error handling", () => {
    it("wraps SDK errors as VAULT_ENCRYPT_FAILED", async () => {
      const badProvider = new AwsKmsProvider({
        keyId: "arn:aws:kms:us-east-1:123456789012:key/does-not-exist",
        region: REGION,
        endpoint: FAKECLOUD_URL,
        credentials: {
          accessKeyId: "test",
          secretAccessKey: "test",
        },
      });

      await expect(badProvider.encrypt("test")).rejects.toMatchObject({
        code: "VAULT_ENCRYPT_FAILED",
      });
    });

    it("wraps SDK errors as VAULT_DECRYPT_FAILED", async () => {
      const badProvider = new AwsKmsProvider({
        keyId: keyArn,
        region: REGION,
        endpoint: FAKECLOUD_URL,
        credentials: {
          accessKeyId: "test",
          secretAccessKey: "test",
        },
      });

      await expect(
        badProvider.decrypt("invalid-base64-ciphertext"),
      ).rejects.toMatchObject({
        code: "VAULT_DECRYPT_FAILED",
      });
    });
  });
});
