import { ContextDetector, streamMeta } from "../base";

const PESEL_WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3, 1];

function peselValid(digits: string): boolean {
  if (digits.length !== 11) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 11; i++) {
    sum += PESEL_WEIGHTS[i]! * (digits.charCodeAt(i) - 48);
  }

  return sum % 10 === 0;
}

export class PlPeselDetector extends ContextDetector {
  readonly id = "pl_pesel";
  readonly entityType = "pl_pesel";
  readonly replacement = "[PL_PESEL]";

  protected readonly pattern = /\d{11}/g;
  protected readonly contextLabels =
    "(?:PESEL|Polish ID|National ID|Identity Number)";
  protected readonly labelStrings = [
    "PESEL",
    "Polish ID",
    "National ID",
    "Identity Number",
  ] as const;
  protected readonly leftContext = 30;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!peselValid(candidate)) {
      return false;
    }

    return ["pl_pesel.checksum"];
  }
}

export const plPeselDetector = new PlPeselDetector();
