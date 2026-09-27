import { ContextDetector, streamMeta } from "../base";

function structurallyValid(candidate: string): boolean {
  return candidate.length === 10 || candidate.length === 11;
}

export class DeIdDetector extends ContextDetector {
  readonly id = "de_id";
  readonly entityType = "de_id";
  readonly replacement = "[DE_ID]";

  protected readonly pattern = /[A-Z0-9]{4}\d{7}|\d{10}/gi;
  protected readonly contextLabels =
    "(?:Personalausweis|German ID|National ID|Identity Card|Ausweis)";
  protected readonly labelStrings = [
    "Personalausweis",
    "German ID",
    "National ID",
    "Identity Card",
    "Ausweis",
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

    return ["de_id.format"];
  }
}

export const deIdDetector = new DeIdDetector();
