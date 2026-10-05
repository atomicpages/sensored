import { luhnValid } from "../checksum";
import { ChecksumDetector } from "../checksum-detector";

export class CaSinDetector extends ChecksumDetector {
  readonly id = "ca_sin";
  readonly entityType = "ca_sin";
  readonly replacement = "[CA_SIN]";
  override readonly stream = Object.freeze({
    maxMatchLength: 11,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  protected pattern = /\d{3}-\d{3}-\d{3}|\d{9}/g;

  protected validate(candidate: string): false | readonly string[] {
    const digits = candidate.replace(/-/g, "");

    if (digits.length !== 9) {
      return false;
    }

    if (!luhnValid(digits)) {
      return false;
    }

    return ["ca_sin.luhn", "ca_sin.format"];
  }
}

export const caSinDetector = new CaSinDetector();
