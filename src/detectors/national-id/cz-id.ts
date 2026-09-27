import { ContextDetector, streamMeta } from "../base";

function structurallyValid(candidate: string): boolean {
  const digits = candidate.replace(/\//, "");

  if (digits.length !== 10) {
    return false;
  }

  const month = Number.parseInt(digits.slice(2, 4), 10);
  const day = Number.parseInt(digits.slice(4, 6), 10);

  if (!((month >= 1 && month <= 12) || (month >= 51 && month <= 62))) {
    return false;
  }

  if (day < 1 || day > 31) {
    return false;
  }

  return true;
}

export class CzIdDetector extends ContextDetector {
  readonly id = "cz_id";
  readonly entityType = "cz_id";
  readonly replacement = "[CZ_ID]";

  protected readonly pattern = /\d{6}\/\d{4}/g;
  protected readonly contextLabels =
    "(?:Czech|Czechia|Republic|Rodné|Číslo|National ID)";
  protected readonly labelStrings = [
    "Czech",
    "Czechia",
    "Republic",
    "Rodné",
    "Číslo",
    "National ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!structurallyValid(candidate)) {
      return false;
    }

    return ["cz_id.structure"];
  }
}

export const czIdDetector = new CzIdDetector();
