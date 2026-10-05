import { ContextDetector, streamMeta } from "../base";

function nhsChecksum(digits: string): boolean {
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]!, 10) * (10 - i);
  }

  return sum % 11 === 0;
}

export class UkNhsDetector extends ContextDetector {
  readonly id = "uk_nhs";
  readonly entityType = "uk_nhs";
  readonly replacement = "[UK_NHS]";

  protected readonly pattern = /\d{3}[- ]?\d{3}[- ]?\d{3}/g;
  protected readonly contextLabels = "(?:nhs[- ]?(?:no\\.?|number)?|patient)";
  protected readonly labelStrings = [
    "nhs",
    "nhs no.",
    "nhs no",
    "nhs number",
    "patient",
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

    if (digits.length !== 9) {
      return false;
    }

    if (!nhsChecksum(digits)) {
      return false;
    }

    return ["uk_nhs.checksum", "uk_nhs.format"];
  }
}

export const ukNhsDetector = new UkNhsDetector();
