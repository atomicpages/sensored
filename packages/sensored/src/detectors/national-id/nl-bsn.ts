import { ContextDetector, streamMeta } from "../base";

function bsnValid(digits: string): boolean {
  if (digits.length !== 9) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 8; i++) {
    sum += (9 - i) * (digits.charCodeAt(i) - 48);
  }

  sum -= digits.charCodeAt(8) - 48;

  return sum % 11 === 0;
}

export class NlBsnDetector extends ContextDetector {
  readonly id = "nl_bsn";
  readonly entityType = "nl_bsn";
  readonly replacement = "[NL_BSN]";

  protected readonly pattern = /\d{3}\.\d{3}\.\d{3}|\d{9}/g;
  protected readonly contextLabels =
    "(?:BSN|Burgerservicenummer|Dutch ID|Citizen Service Number)";
  protected readonly labelStrings = [
    "BSN",
    "Burgerservicenummer",
    "Dutch ID",
    "Citizen Service Number",
  ] as const;
  protected readonly leftContext = 30;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    const digits = candidate.replace(/\./g, "");

    if (!bsnValid(digits)) {
      return false;
    }

    return ["nl_bsn.checksum"];
  }
}

export const nlBsnDetector = new NlBsnDetector();
