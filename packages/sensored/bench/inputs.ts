/** Shared benchmark inputs, used by `benchmark.ts` and `engine-gate.ts`. */

export const CHAT_SIZE = 4096;
export const DOC_SIZE = 1_048_576;

export const PII_SAMPLES = [
  "SSN: 123-45-6789 ",
  "Card: 4242 4242 4242 4242 ",
  "email: user@example.com ",
  "phone: +1 555 123 4567 ",
  "NINO: AB123456C ",
  "SIN: 123-456-789 ",
  "TFN: 123 456 789 ",
  "My Number: 1234 5678 9012 ",
  "VAT: DE123456789 ",
  "IBAN: GB29 NWBK 6016 1331 9268 19 ",
  "Passport: 123456789 ",
  "DL: D1234567 ",
  "John Smith said ",
  "VIN: 1HGCM82633A123456 ",
  "IMEI: 490154203237518 ",
  "IMSI: 310150123456789 ",
  "Tracking: 1Z999AA10123456784 ",
];

export const PII_HIGH = PII_SAMPLES.join("");

export function generateChatInput(
  size: number,
  density: "none" | "low" | "high",
): string {
  const parts: string[] = [];
  let remaining = size;

  while (remaining > 0) {
    if (density === "none") {
      parts.push("ordinary text without any sensitive data here ");
    } else if (density === "low") {
      const idx = Math.floor(Math.random() * PII_SAMPLES.length);
      if (Math.random() < 0.15) {
        parts.push(PII_SAMPLES[idx] ?? "");
      } else {
        parts.push("ordinary text without any sensitive data here ");
      }
    } else {
      parts.push(PII_HIGH);
    }

    remaining -= parts[parts.length - 1]?.length ?? 0;
  }

  return parts.join("").slice(0, size);
}

export function generateUnicodeInput(size: number): string {
  const parts: string[] = [
    "\uD83D\uDE00 SSN: 123-45-6789 ",
    "e\u0301\u0302\u0303 Card: 4242 4242 4242 4242 ",
    "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67 email: user@example.com ",
    "na\u0308ive phone: +1 555 123 4567 ",
    "\uD83C\uDDEC\uD83C\uDDE7 IBAN: GB29 NWBK 6016 1331 9268 19 ",
    "Passport: 123456789 DL: D1234567 ",
    "John Smith said NINO: AB123456C ",
  ];

  let result = "";
  while (result.length < size) {
    result += parts[Math.floor(Math.random() * parts.length)];
  }
  return result.slice(0, size);
}
