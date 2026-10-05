import { ChecksumDetector } from "../checksum-detector";

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

const VIN_TRANSLIT: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
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
};

function vinChecksumValid(vin: string): boolean {
  let sum = 0;

  for (let i = 0; i < 17; i++) {
    const ch = vin[i];
    if (ch === undefined) {
      return false;
    }

    const value = VIN_TRANSLIT[ch];
    if (value === undefined) {
      return false;
    }

    sum += value * VIN_WEIGHTS[i]!;
  }

  const computed = sum % 11;
  const checkChar = computed === 10 ? "X" : String(computed);

  return vin[8] === checkChar;
}

function allSameChar(candidate: string): boolean {
  const first = candidate.charCodeAt(0);

  for (let i = 1; i < candidate.length; i++) {
    if (candidate.charCodeAt(i) !== first) {
      return false;
    }
  }

  return true;
}

export class VinDetector extends ChecksumDetector {
  readonly id = "vin";
  readonly entityType = "vin";
  readonly replacement = "[VIN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 17,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  protected pattern = /[A-HJ-NPR-Z0-9]{17}/gi;

  protected validate(candidate: string): false | readonly string[] {
    if (candidate.length !== 17) {
      return false;
    }

    if (!/\d/.test(candidate)) {
      return false;
    }

    if (allSameChar(candidate)) {
      return false;
    }

    if (!vinChecksumValid(candidate)) {
      return false;
    }

    return ["vin.checksum", "vin.format"];
  }
}

export const vinDetector = new VinDetector();
