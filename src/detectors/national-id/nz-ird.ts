import { ContextDetector, streamMeta } from "../base";

function irdChecksum(digits: string): boolean {
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    sum += parseInt(digits[i]!, 10) * weights[i]!;
  }

  const remainder = sum % 11;

  if (remainder === 0) {
    return false;
  }

  const checkDigit = 11 - remainder;

  return checkDigit === parseInt(digits[8]!, 10);
}

export class NzIrdDetector extends ContextDetector {
  readonly id = "nz_ird";
  readonly entityType = "nz_ird";
  readonly replacement = "[NZ_IRD]";

  protected readonly pattern = /\d{2,3}[- ]?\d{3}[- ]?\d{3}/g;
  protected readonly contextLabels =
    "(?:ird[- ]?(?:no\\.?|number)?|nz[- ]?ird|tax[- ]?(?:no\\.?|number)?)";
  protected readonly labelStrings = [
    "ird",
    "ird no.",
    "ird no",
    "ird number",
    "nz ird",
    "tax",
    "tax no.",
    "tax no",
    "tax number",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 40;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    const digits = candidate.replace(/[- ]/g, "");

    if (digits.length < 8 || digits.length > 9) {
      return false;
    }

    const padded = digits.length === 8 ? "0" + digits : digits;

    if (!irdChecksum(padded)) {
      return false;
    }

    return ["nz_ird.checksum", "nz_ird.format"];
  }
}

export const nzIrdDetector = new NzIrdDetector();
