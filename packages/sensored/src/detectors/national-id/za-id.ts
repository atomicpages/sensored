import { ContextDetector, streamMeta } from "../base";

function structurallyValid(candidate: string): boolean {
  if (candidate.length !== 13) {
    return false;
  }

  const month = Number.parseInt(candidate.slice(2, 4), 10);
  const day = Number.parseInt(candidate.slice(4, 6), 10);

  if (month < 1 || month > 12) {
    return false;
  }

  if (day < 1 || day > 31) {
    return false;
  }

  return true;
}

export class ZaIdDetector extends ContextDetector {
  readonly id = "za_id";
  readonly entityType = "za_id";
  readonly replacement = "[ZA_ID]";

  protected readonly pattern = /\d{13}/g;
  protected readonly contextLabels =
    "(?:South Africa|RSA|ZA|National ID|Identity|ID Number)";
  protected readonly labelStrings = [
    "South Africa",
    "RSA",
    "ZA",
    "National ID",
    "Identity",
    "ID Number",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    13,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!structurallyValid(candidate)) {
      return false;
    }

    return ["za_id.structure"];
  }
}

export const zaIdDetector = new ZaIdDetector();
