import { ChecksumDetector } from "../checksum-detector";

const TFN_WEIGHTS = [1, 4, 3, 7, 5, 8, 6, 9, 10];

function tfnValid(digits: string): boolean {
  if (digits.length < 8 || digits.length > 9) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < digits.length; i++) {
    const digit = digits.charCodeAt(i) - 48;
    sum += digit * TFN_WEIGHTS[i]!;
  }

  return sum % 11 === 0;
}

export class AuTfnDetector extends ChecksumDetector {
  readonly id = "au_tfn";
  readonly entityType = "au_tfn";
  readonly replacement = "[AU_TFN]";
  override readonly stream = Object.freeze({
    maxMatchLength: 11,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  protected pattern = /\d{3} \d{3} \d{3}|\d{3} \d{3} \d{2}|\d{8,9}/g;

  protected validate(candidate: string): false | readonly string[] {
    const digits = candidate.replace(/ /g, "");

    if (!tfnValid(digits)) {
      return false;
    }

    return ["au_tfn.checksum", "au_tfn.format"];
  }
}

export const auTfnDetector = new AuTfnDetector();
