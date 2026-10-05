import { ContextDetector, streamMeta } from "../base";

const oddValues: Record<string, number> = {
  "0": 1,
  "1": 0,
  "2": 5,
  "3": 7,
  "4": 9,
  "5": 13,
  "6": 15,
  "7": 17,
  "8": 19,
  "9": 21,
  A: 1,
  B: 0,
  C: 5,
  D: 7,
  E: 9,
  F: 13,
  G: 15,
  H: 17,
  I: 19,
  J: 21,
  K: 2,
  L: 4,
  M: 18,
  N: 20,
  O: 11,
  P: 3,
  Q: 6,
  R: 8,
  S: 10,
  T: 12,
  U: 14,
  V: 16,
  W: 22,
  X: 25,
  Y: 24,
  Z: 23,
};

const evenValues: Record<string, number> = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
  H: 7,
  I: 8,
  J: 9,
  K: 10,
  L: 11,
  M: 12,
  N: 13,
  O: 14,
  P: 15,
  Q: 16,
  R: 17,
  S: 18,
  T: 19,
  U: 20,
  V: 21,
  W: 22,
  X: 23,
  Y: 24,
  Z: 25,
};

function codiceFiscaleValid(candidate: string): boolean {
  if (candidate.length !== 16) {
    return false;
  }

  const upper = candidate.toUpperCase();
  let sum = 0;

  for (let i = 0; i < 15; i++) {
    const char = upper[i]!;

    if (i % 2 === 0) {
      sum += oddValues[char] ?? 0;
    } else {
      sum += evenValues[char] ?? 0;
    }
  }

  const expectedControl = String.fromCharCode(65 + (sum % 26));

  return expectedControl === upper[15];
}

export class ItCodiceFiscaleDetector extends ContextDetector {
  readonly id = "it_codice_fiscale";
  readonly entityType = "it_codice_fiscale";
  readonly replacement = "[IT_CODICE_FISCALE]";

  protected readonly pattern = /[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/gi;
  protected readonly contextLabels =
    "(?:Codice Fiscale|Fiscal Code|Tax Code|Italian ID)";
  protected readonly labelStrings = [
    "Codice Fiscale",
    "Fiscal Code",
    "Tax Code",
    "Italian ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    16,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!codiceFiscaleValid(candidate)) {
      return false;
    }

    return ["it_codice_fiscale.checksum"];
  }
}

export const itCodiceFiscaleDetector = new ItCodiceFiscaleDetector();
