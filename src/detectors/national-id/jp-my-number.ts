import { ChecksumDetector } from "../checksum-detector";

const WEIGHTS = [6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

function myNumberValid(digits: string): boolean {
  if (digits.length !== 12) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 11; i++) {
    const digit = digits.charCodeAt(i) - 48;
    sum += digit * WEIGHTS[i]!;
  }

  const remainder = sum % 11;

  const checkDigit = remainder <= 1 ? 0 : 11 - remainder;

  return digits.charCodeAt(11) - 48 === checkDigit;
}

export class JpMyNumberDetector extends ChecksumDetector {
  readonly id = "jp_my_number";
  readonly entityType = "jp_my_number";
  readonly replacement = "[JP_MY_NUMBER]";
  override readonly stream = Object.freeze({
    maxMatchLength: 14,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  protected pattern = /\d{4} \d{4} \d{4}|\d{12}/g;

  protected validate(candidate: string): false | readonly string[] {
    const digits = candidate.replace(/ /g, "");

    if (!myNumberValid(digits)) {
      return false;
    }

    return ["jp_my_number.checksum", "jp_my_number.format"];
  }
}

export const jpMyNumberDetector = new JpMyNumberDetector();
