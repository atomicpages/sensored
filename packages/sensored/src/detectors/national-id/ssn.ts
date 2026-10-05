import { ContextDetector, streamMeta } from "../base";

function structurallyValid(candidate: string): boolean {
  const digits = candidate.replace(/-/g, "");

  if (digits.length !== 9) {
    return false;
  }

  const first = digits.slice(0, 3);
  const middle = digits.slice(3, 5);
  const last = digits.slice(5, 9);

  if (first === "000" || first === "666") {
    return false;
  }

  const firstNum = Number.parseInt(first, 10);

  if (firstNum >= 900) {
    return false;
  }

  if (middle === "00") {
    return false;
  }

  if (last === "0000") {
    return false;
  }

  return true;
}

export class SSNDetector extends ContextDetector {
  readonly id = "us_ssn";
  readonly entityType = "us_ssn";
  readonly replacement = "[US_SSN]";

  protected readonly pattern = /\d{3}-\d{2}-\d{4}|\d{9}/g;
  protected readonly contextLabels =
    "(?:SSN|Social Security Number|Social Security No\\.)";
  protected readonly labelStrings = [
    "SSN",
    "Social Security Number",
    "Social Security No.",
  ] as const;
  protected readonly leftContext = 39;
  protected readonly rightContext = 32;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(_candidate: string): false | readonly string[] {
    if (!structurallyValid(_candidate)) {
      return false;
    }

    return ["us_ssn.structure"];
  }
}

export const ssnDetector = new SSNDetector();
