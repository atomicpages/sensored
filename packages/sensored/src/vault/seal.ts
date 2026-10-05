import type { RestorationMap } from "../types";
import { decryptWithDek, encryptWithDek, zeroDek } from "./dek";
import {
  SEALED_BLOB_VERSION,
  type SealedBlob,
  type SealedBlobMetadata,
  VaultError,
  type VaultProvider,
} from "./types";

function isRestorationMap(value: unknown): value is RestorationMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((v) => typeof v === "string");
}

function isSealedBlob(value: unknown): value is SealedBlob {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.version === "number" &&
    obj.version === SEALED_BLOB_VERSION &&
    typeof obj.provider === "string" &&
    typeof obj.createdAt === "string" &&
    typeof obj.encryptedDek === "string" &&
    typeof obj.encryptedMap === "string" &&
    (obj.metadata === undefined || typeof obj.metadata === "object")
  );
}

export async function seal(
  map: RestorationMap,
  provider: VaultProvider,
  metadata?: SealedBlobMetadata,
): Promise<string> {
  const { plaintext: dekPlaintext, encrypted: encryptedDek } =
    await provider.generateDataKey();

  const dek = Buffer.from(dekPlaintext, "base64");

  try {
    const mapJson = JSON.stringify(map);
    const encryptedMap = encryptWithDek(mapJson, dek);

    const blob: SealedBlob = {
      version: SEALED_BLOB_VERSION,
      provider: provider.name,
      createdAt: new Date().toISOString(),
      encryptedDek,
      encryptedMap,
      metadata,
    };

    return serializeSealedBlob(blob);
  } finally {
    zeroDek(dek);
  }
}

export async function open(
  serialized: string,
  provider: VaultProvider,
): Promise<RestorationMap> {
  const blob = deserializeSealedBlob(serialized);

  if (blob.provider !== provider.name) {
    throw new VaultError("VAULT_PROVIDER_MISMATCH");
  }

  const dekBase64 = await provider.decryptDataKey(blob.encryptedDek);
  const dek = Buffer.from(dekBase64, "base64");

  try {
    const mapJson = decryptWithDek(blob.encryptedMap, dek);
    const parsed: unknown = JSON.parse(mapJson);

    if (!isRestorationMap(parsed)) {
      throw new VaultError("VAULT_INVALID_SEALED_BLOB");
    }

    return parsed;
  } finally {
    zeroDek(dek);
  }
}

export function serializeSealedBlob(blob: SealedBlob): string {
  return Buffer.from(JSON.stringify(blob), "utf8").toString("base64");
}

export function deserializeSealedBlob(serialized: string): SealedBlob {
  try {
    const json = Buffer.from(serialized, "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);

    if (!isSealedBlob(parsed)) {
      throw new VaultError("VAULT_INVALID_SEALED_BLOB");
    }

    return parsed;
  } catch (e) {
    if (e instanceof VaultError) {
      throw e;
    }

    throw new VaultError("VAULT_INVALID_SEALED_BLOB", e);
  }
}
