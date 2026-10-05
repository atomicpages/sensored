import { randomBytes } from "node:crypto";
import { aesGcmDecrypt, aesGcmEncrypt } from "./aes";

const KEY_LENGTH = 32;

export function generateDek(): Buffer {
  return randomBytes(KEY_LENGTH);
}

export function encryptWithDek(plaintext: string, dek: Buffer): string {
  if (dek.length !== KEY_LENGTH) {
    throw new Error(`DEK must be ${KEY_LENGTH} bytes, got ${dek.length}`);
  }
  return aesGcmEncrypt(Buffer.from(plaintext, "utf8"), dek).toString("base64");
}

export function decryptWithDek(ciphertext: string, dek: Buffer): string {
  if (dek.length !== KEY_LENGTH) {
    throw new Error(`DEK must be ${KEY_LENGTH} bytes, got ${dek.length}`);
  }
  return aesGcmDecrypt(Buffer.from(ciphertext, "base64"), dek).toString("utf8");
}

export function zeroDek(dek: Buffer): void {
  dek.fill(0);
}

export { KEY_LENGTH as DEK_LENGTH };
