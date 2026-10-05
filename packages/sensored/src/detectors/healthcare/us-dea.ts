import { ContextDetector, streamMeta } from "../base";

function deaChecksum(digits: string): boolean {
  let sum = 0;

  for (let i = 0; i < 6; i++) {
    sum += parseInt(digits[i]!, 10);
  }

  const lastDigit = parseInt(digits[6]!, 10);
  const computed = sum % 10;

  return lastDigit === computed;
}

export class UsDeaDetector extends ContextDetector {
  readonly id = "us_dea";
  readonly entityType = "us_dea";
  readonly replacement = "[US_DEA]";

  protected readonly pattern = /[A-DF-MP-R][A-Z]\d{7}/g;
  protected readonly contextLabels =
    "(?:dea[- ]?(?:no\\.?|number)?|prescriber)";
  protected readonly labelStrings = [
    "dea",
    "dea no.",
    "dea no",
    "dea number",
    "prescriber",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 40;

  override readonly stream = streamMeta(9, this.leftContext, this.rightContext);

  protected override validate(candidate: string): false | readonly string[] {
    const digits = candidate.slice(2);

    if (!deaChecksum(digits)) {
      return false;
    }

    return ["us_dea.checksum", "us_dea.format"];
  }
}

export const usDeaDetector = new UsDeaDetector();
