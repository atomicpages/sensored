import { luhnValid } from "../checksum";
import { ChecksumDetector } from "../checksum-detector";

function allSameDigit(digits: string): boolean {
  const first = digits.charCodeAt(0);

  for (let i = 1; i < digits.length; i++) {
    if (digits.charCodeAt(i) !== first) {
      return false;
    }
  }

  return true;
}

export class ImeiDetector extends ChecksumDetector {
  readonly id = "imei";
  readonly entityType = "imei";
  readonly replacement = "[IMEI]";
  override readonly stream = Object.freeze({
    maxMatchLength: 16,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  protected pattern = /\d{15,16}/g;

  protected validate(candidate: string): false | readonly string[] {
    if (candidate.length !== 15 && candidate.length !== 16) {
      return false;
    }

    if (allSameDigit(candidate)) {
      return false;
    }

    const checkDigits =
      candidate.length === 16 ? candidate.slice(0, 15) : candidate;

    if (!luhnValid(checkDigits)) {
      return false;
    }

    return ["imei.luhn", "imei.format"];
  }
}

export const imeiDetector = new ImeiDetector();
