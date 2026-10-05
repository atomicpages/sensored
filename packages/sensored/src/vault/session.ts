import { createSharedRedactor } from "../adapters/shared";
import { resolvePolicy } from "../policy";
import { restore } from "../restore";
import { StreamRestorer } from "../stream-restore";
import { SESSION_BRAND } from "../symbols";
import { redactValue } from "../traverse";
import type { RestorationMap } from "../types";
import { decryptWithDek, encryptWithDek, zeroDek } from "./dek";
import { seal as sealMap } from "./seal";
import { type EncryptedSession, type VaultConfig, VaultError } from "./types";

export async function createEncryptedSession(
  config: VaultConfig,
): Promise<EncryptedSession> {
  if (config.redactorConfig.detectOnly) {
    throw new VaultError(
      "VAULT_ENCRYPT_FAILED",
      new Error("detectOnly not supported in encrypted session"),
    );
  }

  const { rules, allowlist } = resolvePolicy(config.redactorConfig);

  const { plaintext: dekPlaintext } = await config.provider.generateDataKey();
  const dek = Buffer.from(dekPlaintext, "base64");

  const encryptedMap = new Map<string, string>();

  if (config.existingMap) {
    for (const [placeholder, original] of Object.entries(config.existingMap)) {
      const entry = encryptWithDek(original, dek);
      encryptedMap.set(placeholder, entry);
    }
  }

  let shared = createSharedRedactor(rules, allowlist, {
    dedup: true,
    initialMap: config.existingMap,
  });

  function getDecryptedMap(): RestorationMap {
    const result: Record<string, string> = {};

    for (const [placeholder, entry] of encryptedMap) {
      result[placeholder] = decryptWithDek(entry, dek);
    }

    return result;
  }

  const session: EncryptedSession = {
    redact(text: string): string {
      const beforeKeys = new Set(encryptedMap.keys());
      const redacted = shared.redact(text);

      for (const [placeholder, original] of Object.entries(shared.map)) {
        if (!beforeKeys.has(placeholder)) {
          encryptedMap.set(placeholder, encryptWithDek(original, dek));
        }
      }

      return redacted;
    },

    redactMessages<T extends readonly { role: string; content: unknown }[]>(
      messages: T,
    ): T {
      return redactValue(messages, {
        redact: (text: string) => session.redact(text),
      });
    },

    restore(text: string): string {
      return restore(text, getDecryptedMap());
    },

    stream(): StreamRestorer {
      return new StreamRestorer(getDecryptedMap());
    },

    reset(): void {
      encryptedMap.clear();
      shared = createSharedRedactor(rules, allowlist, {
        dedup: true,
        initialMap: config.existingMap,
      });
    },

    async seal(): Promise<string> {
      const map = getDecryptedMap();
      return sealMap(map, config.provider);
    },

    get map(): RestorationMap {
      return getDecryptedMap();
    },

    dispose(): void {
      encryptedMap.clear();
      zeroDek(dek);
    },

    [SESSION_BRAND]: true as const,
  };

  return session;
}
