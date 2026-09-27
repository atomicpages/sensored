import { luhnValid } from "../checksum";
import { ChecksumDetector } from "../checksum-detector";

const ES_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const NL_WEIGHTS = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

type VatValidator = (body: string) => string[] | null;

function nlValid(digits: string, suffix: string): boolean {
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += (digits.charCodeAt(i) - 48) * NL_WEIGHTS[i]!;
  }

  return sum % 11 === parseInt(suffix, 10);
}

function esValid(digits: string, letter: string | undefined): boolean {
  if (letter === undefined) {
    return true;
  }

  const index = parseInt(digits, 10) % 23;

  return ES_LETTERS[index] === letter;
}

const VALIDATORS: Record<string, VatValidator> = {
  DE: () => ["eu_vat.format"],
  FR: (body) => {
    const digits = body.slice(2);

    if (!luhnValid(digits)) {
      return null;
    }

    return ["eu_vat.checksum", "eu_vat.format"];
  },
  IT: (body) => {
    if (!luhnValid(body)) {
      return null;
    }

    return ["eu_vat.checksum", "eu_vat.format"];
  },
  ES: (body) => {
    const digits = body.slice(0, 8);
    const letter = body.length > 8 ? body[8] : undefined;

    if (!esValid(digits, letter)) {
      return null;
    }

    return letter !== undefined
      ? ["eu_vat.checksum", "eu_vat.format"]
      : ["eu_vat.format"];
  },
  NL: (body) => {
    const digits = body.slice(0, 9);
    const suffix = body.slice(10);

    if (!nlValid(digits, suffix)) {
      return null;
    }

    return ["eu_vat.checksum", "eu_vat.format"];
  },
};

export class EuVatDetector extends ChecksumDetector {
  readonly id = "eu_vat";
  readonly entityType = "eu_vat";
  readonly replacement = "[EU_VAT]";
  override readonly stream = Object.freeze({
    maxMatchLength: 15,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  protected pattern =
    /(?:DE\d{9}|FR[A-Z]{2}\d{11}|IT\d{11}|ES\d{8}[A-Z]?|NL\d{9}B\d{2})/g;

  protected validate(candidate: string): false | readonly string[] {
    const country = candidate.slice(0, 2);
    const body = candidate.slice(2);
    const validate = VALIDATORS[country];

    if (!validate) {
      return false;
    }

    const reasons = validate(body);

    if (reasons === null) {
      return false;
    }

    return reasons;
  }
}

export const euVatDetector = new EuVatDetector();
