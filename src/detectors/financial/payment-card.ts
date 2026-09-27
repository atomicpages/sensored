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

export class PaymentCardDetector extends ChecksumDetector {
  readonly id = "payment_card";
  readonly entityType = "payment_card";
  readonly replacement = "[PAYMENT_CARD]";
  override readonly stream = Object.freeze({
    maxMatchLength: 37,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  protected pattern = /\d+(?:[ -]\d+)*/g;

  protected validate(candidate: string): false | readonly string[] {
    let separator: string | null = null;
    let digits = "";
    let groupSize = 0;
    let valid = true;

    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];

      if (ch === undefined) {
        valid = false;
        break;
      }

      if (ch >= "0" && ch <= "9") {
        digits += ch;
        groupSize++;
      } else {
        if (separator === null) {
          separator = ch;
        } else if (separator !== ch) {
          valid = false;
          break;
        }

        if (groupSize < 1 || groupSize > 6) {
          valid = false;
          break;
        }

        groupSize = 0;
      }
    }

    if (valid && groupSize < 1) {
      valid = false;
    }

    if (!valid) {
      return false;
    }

    if (digits.length < 13 || digits.length > 19) {
      return false;
    }

    if (candidate.length > 37) {
      return false;
    }

    if (allSameDigit(digits)) {
      return false;
    }

    if (!luhnValid(digits)) {
      return false;
    }

    return ["payment_card.luhn", "payment_card.format"];
  }
}

export const paymentCardDetector = new PaymentCardDetector();
