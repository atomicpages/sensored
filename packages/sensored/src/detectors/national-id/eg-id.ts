import { ContextDetector, streamMeta } from "../base";

function structurallyValid(candidate: string): boolean {
  if (candidate.length !== 14) {
    return false;
  }

  const month = Number.parseInt(candidate.slice(5, 7), 10);
  const day = Number.parseInt(candidate.slice(7, 9), 10);

  if (month < 1 || month > 12) {
    return false;
  }

  if (day < 1 || day > 31) {
    return false;
  }

  return true;
}

export class EgIdDetector extends ContextDetector {
  readonly id = "eg_id";
  readonly entityType = "eg_id";
  readonly replacement = "[EG_ID]";

  protected readonly pattern = /[12]\d{13}/g;
  protected readonly contextLabels = "(?:Egypt|Egyptian|National ID|Identity)";
  protected readonly labelStrings = [
    "Egypt",
    "Egyptian",
    "National ID",
    "Identity",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    14,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!structurallyValid(candidate)) {
      return false;
    }

    return ["eg_id.structure"];
  }
}

export const egIdDetector = new EgIdDetector();
