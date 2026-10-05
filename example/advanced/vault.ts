/**
 * Vault: encrypted persistence for restoration maps.
 *
 * Demonstrates the full vault lifecycle with LocalVaultProvider —
 * redact, seal, open, hydrate, restore, dispose.
 *
 * No API keys required.
 *
 * Usage:
 *   bun run advanced/vault.ts
 */

import {
  createEncryptedSession,
  LocalVaultProvider,
  open,
  seal,
  VaultError,
} from "sensored/vault";

const text = [
  "Patient: John Smith",
  "Email: john.smith@example.com",
  "Phone: 555-867-5309",
  "SSN: 123-45-6789",
].join(" | ");

const provider = new LocalVaultProvider({
  passphrase: "correct-horse-battery-staple",
});

console.log("--- Creating Encrypted Session ---");

const session = await createEncryptedSession({
  provider,
  redactorConfig: {
    presets: ["pii"],
    rules: {
      person_name_lite: { action: "redact" },
      email: { action: "redact" },
      phone: { action: "redact" },
      us_ssn: { action: "format-preserve" },
    },
    restore: true,
  },
});

console.log("--- Redacting PII ---");

const redacted = session.redact(text);

console.log(`  Original:  ${text}`);
console.log(`  Redacted:  ${redacted}`);
console.log();

console.log("--- Restoration Map (in-memory, encrypted) ---");

const map = session.map;

console.log(map);
console.log();

console.log("--- Sealing Session ---");

const sealedBlob = await session.seal();

console.log(`  Sealed blob (${sealedBlob.length} chars):`);
console.log(`  ${sealedBlob.slice(0, 80)}...`);
console.log();

console.log("--- Opening Sealed Blob ---");

const recoveredMap = await open(sealedBlob, provider);

console.log(recoveredMap);
console.log();

console.log("--- Hydrating New Session from Recovered Map ---");

const session2 = await createEncryptedSession({
  provider,
  redactorConfig: {
    presets: ["pii"],
    rules: {
      person_name_lite: { action: "redact" },
      email: { action: "redact" },
      phone: { action: "redact" },
      us_ssn: { action: "format-preserve" },
    },
    restore: true,
  },
  existingMap: recoveredMap,
});

console.log("--- Restoring with Hydrated Session ---");

const restored = session2.restore(redacted);

console.log(`  Restored: ${restored}`);
console.log();

console.log(`Round-trip ${restored === text ? "PASS ✓" : "FAIL ✗"}`);

console.log();

console.log("--- Sealing with Metadata ---");

const sealedWithMeta = await seal(
  { "[EMAIL_1]": "john.smith@example.com" },
  provider,
  { source: "demo", version: "1" },
);

const recoveredFromMeta = await open(sealedWithMeta, provider);

console.log(`  Metadata preserved: ${JSON.stringify(recoveredFromMeta)}`);
console.log();

console.log("--- Error Handling: Wrong Provider ---");

const wrongProvider = new LocalVaultProvider({
  passphrase: "different-passphrase",
});

try {
  await open(sealedBlob, wrongProvider);
} catch (error) {
  if (error instanceof VaultError) {
    console.log(`  VaultError: ${error.code}`);
  }
}

console.log();

console.log("--- Disposing Sessions ---");

session.dispose();
session2.dispose();

console.log("  DEKs zeroed, encrypted maps cleared.");
