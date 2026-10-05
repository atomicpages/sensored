import { describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import {
  createEncryptedSession,
  LocalVaultProvider,
  open,
  SEALED_BLOB_VERSION,
  seal,
  VaultError,
} from "../src/vault";
import { deserializeSealedBlob, serializeSealedBlob } from "../src/vault/seal";

const baseConfig = {
  rules: {
    email: { action: "redact" as const },
    phone: { action: "redact" as const },
  },
};

describe("VaultError", () => {
  it("creates error with code and message", () => {
    const err = new VaultError("VAULT_ENCRYPT_FAILED");
    expect(err.name).toBe("VaultError");
    expect(err.code).toBe("VAULT_ENCRYPT_FAILED");
    expect(err.message).toContain("encryption");
  });

  it("attaches cause when provided", () => {
    const cause = new Error("inner");
    const err = new VaultError("VAULT_DECRYPT_FAILED", cause);
    expect(err.cause).toBe(cause);
  });
});

describe("LocalVaultProvider", () => {
  describe("with raw key", () => {
    it("encrypts and decrypts round-trip", async () => {
      const provider = new LocalVaultProvider({ key: randomBytes(32) });
      const plaintext = "hello world";
      const ciphertext = await provider.encrypt(plaintext);
      expect(ciphertext).not.toBe(plaintext);
      const decrypted = await provider.decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it("generates and decrypts data keys", async () => {
      const provider = new LocalVaultProvider({ key: randomBytes(32) });
      const { plaintext, encrypted } = await provider.generateDataKey();
      expect(plaintext).not.toBe(encrypted);
      const decrypted = await provider.decryptDataKey(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("rejects invalid key length", () => {
      expect(() => new LocalVaultProvider({ key: randomBytes(16) })).toThrow(
        VaultError,
      );
    });
  });

  describe("with passphrase", () => {
    it("encrypts and decrypts round-trip", async () => {
      const provider = new LocalVaultProvider({ passphrase: "my-secret-pass" });
      const plaintext = "sensitive data";
      const ciphertext = await provider.encrypt(plaintext);
      const decrypted = await provider.decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it("generates and decrypts data keys", async () => {
      const provider = new LocalVaultProvider({ passphrase: "my-secret-pass" });
      const { plaintext, encrypted } = await provider.generateDataKey();
      const decrypted = await provider.decryptDataKey(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("different passphrases produce different ciphertext", async () => {
      const p1 = new LocalVaultProvider({ passphrase: "pass1" });
      const p2 = new LocalVaultProvider({ passphrase: "pass2" });
      const ct1 = await p1.encrypt("test");
      const ct2 = await p2.encrypt("test");
      expect(ct1).not.toBe(ct2);
    });
  });

  it("throws on missing key and passphrase", () => {
    expect(() => new LocalVaultProvider({})).toThrow(VaultError);
  });
});

describe("seal and open", () => {
  it("seals and opens a restoration map round-trip", async () => {
    const provider = new LocalVaultProvider({ key: randomBytes(32) });
    const map = {
      "[EMAIL_1]": "john@example.com",
      "[PHONE_1]": "415-555-1234",
    };

    const sealed = await seal(map, provider);
    expect(typeof sealed).toBe("string");

    const opened = await open(sealed, provider);
    expect(opened).toEqual(map);
  });

  it("seal produces base64-encoded serialized blob", async () => {
    const provider = new LocalVaultProvider({ key: randomBytes(32) });
    const sealed = await seal({}, provider);
    const blob = deserializeSealedBlob(sealed);
    expect(blob.version).toBe(SEALED_BLOB_VERSION);
    expect(blob.provider).toBe("local");
    expect(blob.createdAt).toBeDefined();
    expect(blob.encryptedDek).toBeDefined();
    expect(blob.encryptedMap).toBeDefined();
  });

  it("throws on provider mismatch", async () => {
    const provider1 = new LocalVaultProvider({ key: randomBytes(32) });
    const provider2 = new LocalVaultProvider({ key: randomBytes(32) });
    const sealed = await seal({}, provider1);
    await expect(open(sealed, provider2)).rejects.toThrow(VaultError);
  });

  it("throws on invalid sealed blob", async () => {
    const provider = new LocalVaultProvider({ key: randomBytes(32) });
    await expect(open("not-valid-base64!!!", provider)).rejects.toThrow(
      VaultError,
    );
  });

  it("includes metadata in sealed blob", async () => {
    const provider = new LocalVaultProvider({ key: randomBytes(32) });
    const metadata = { sessionId: "abc123", userId: "user-456" };
    const sealed = await seal({}, provider, metadata);
    const blob = deserializeSealedBlob(sealed);
    expect(blob.metadata).toEqual(metadata);
  });

  it("serializeSealedBlob and deserializeSealedBlob round-trip", () => {
    const blob = {
      version: SEALED_BLOB_VERSION,
      provider: "local",
      createdAt: "2026-01-01T00:00:00.000Z",
      encryptedDek: "abc",
      encryptedMap: "def",
    };
    const serialized = serializeSealedBlob(blob);
    const deserialized = deserializeSealedBlob(serialized);
    expect(deserialized).toEqual(blob);
  });

  it("deserializeSealedBlob rejects unsupported version", () => {
    const blob = {
      version: 999,
      provider: "local",
      createdAt: "2026-01-01T00:00:00.000Z",
      encryptedDek: "abc",
      encryptedMap: "def",
    };
    const serialized = serializeSealedBlob(blob);
    expect(() => deserializeSealedBlob(serialized)).toThrow(VaultError);
  });
});

describe("createEncryptedSession", () => {
  it("redacts and restores text", async () => {
    const provider = new LocalVaultProvider({ key: randomBytes(32) });
    const session = await createEncryptedSession({
      provider,
      redactorConfig: baseConfig,
    });

    const original = "contact john@example.com";
    const redacted = session.redact(original);
    expect(redacted).toContain("[EMAIL_1]");
    expect(redacted).not.toContain("john@example.com");

    const restored = session.restore(redacted);
    expect(restored).toBe(original);

    session.dispose();
  });

  it("maintains consistent placeholders across calls", async () => {
    const provider = new LocalVaultProvider({ key: randomBytes(32) });
    const session = await createEncryptedSession({
      provider,
      redactorConfig: baseConfig,
    });

    const r1 = session.redact("contact john@example.com");
    const r2 = session.redact("also contact john@example.com");
    expect(r1).toContain("[EMAIL_1]");
    expect(r2).toContain("[EMAIL_1]");
    expect(r2).not.toContain("[EMAIL_2]");

    session.dispose();
  });

  it("seals and reopens with existingMap", async () => {
    const provider = new LocalVaultProvider({ key: randomBytes(32) });
    const session = await createEncryptedSession({
      provider,
      redactorConfig: baseConfig,
    });

    session.redact("contact john@example.com");
    session.redact("call 415-555-1234");

    const sealed = await session.seal();
    session.dispose();

    const openedMap = await open(sealed, provider);
    expect(openedMap["[EMAIL_1]"]).toBe("john@example.com");
    expect(openedMap["[PHONE_1]"]).toBe("415-555-1234");

    const session2 = await createEncryptedSession({
      provider,
      redactorConfig: baseConfig,
      existingMap: openedMap,
    });

    const restored = session2.restore("contact [EMAIL_1] and call [PHONE_1]");
    expect(restored).toBe("contact john@example.com and call 415-555-1234");

    session2.dispose();
  });

  it("reset clears the map", async () => {
    const provider = new LocalVaultProvider({ key: randomBytes(32) });
    const session = await createEncryptedSession({
      provider,
      redactorConfig: baseConfig,
    });

    session.redact("contact john@example.com");
    expect(Object.keys(session.map)).toHaveLength(1);

    session.reset();
    expect(Object.keys(session.map)).toHaveLength(0);

    session.dispose();
  });

  it("stream restores placeholders", async () => {
    const provider = new LocalVaultProvider({ key: randomBytes(32) });
    const session = await createEncryptedSession({
      provider,
      redactorConfig: baseConfig,
    });

    const redacted = session.redact("contact john@example.com");
    const restorer = session.stream();

    const result = restorer.push(redacted);
    expect(result).toBe("contact john@example.com");

    session.dispose();
  });

  it("redactMessages redacts structured messages", async () => {
    const provider = new LocalVaultProvider({ key: randomBytes(32) });
    const session = await createEncryptedSession({
      provider,
      redactorConfig: baseConfig,
    });

    const messages = [
      { role: "user", content: "contact john@example.com" },
      { role: "assistant", content: "I will email [EMAIL_1]" },
    ];

    const redacted = session.redactMessages(messages);
    expect(redacted[0]?.content).toBe("contact [EMAIL_1]");
    expect(redacted[1]?.content).toBe("I will email [EMAIL_1]");

    session.dispose();
  });

  it("throws on detectOnly config", async () => {
    const provider = new LocalVaultProvider({ key: randomBytes(32) });
    await expect(
      createEncryptedSession({
        provider,
        redactorConfig: { ...baseConfig, detectOnly: true },
      }),
    ).rejects.toThrow(VaultError);
  });
});
