import { ContextDetector, streamMeta } from "../base";

function structurallyValid(candidate: string): boolean {
  if (candidate.length !== 13) {
    return false;
  }

  const day = Number.parseInt(candidate.slice(0, 2), 10);
  const month = Number.parseInt(candidate.slice(2, 4), 10);

  if (day < 1 || day > 31) {
    return false;
  }

  if (month < 1 || month > 12) {
    return false;
  }

  return true;
}

export class RsJmbgDetector extends ContextDetector {
  readonly id = "rs_jmbg";
  readonly entityType = "rs_jmbg";
  readonly replacement = "[RS_JMBG]";

  protected readonly pattern = /\d{13}/g;
  protected readonly contextLabels =
    "(?:Serbian|Serbia|JMBG|Jedinstveni|Matični|Personal)";
  protected readonly labelStrings = [
    "Serbian",
    "Serbia",
    "JMBG",
    "Jedinstveni",
    "Matični",
    "Personal",
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

    return ["rs_jmbg.structure"];
  }
}

export const rsJmbgDetector = new RsJmbgDetector();
