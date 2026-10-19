import { ContextDetector, streamMeta } from "../base";

export class ToIdDetector extends ContextDetector {
  readonly id = "to_id";
  readonly entityType = "to_id";
  readonly replacement = "[TO_ID]";

  protected readonly pattern = /[A-Z0-9]{8,10}/gi;
  protected readonly contextLabels = "(?:Tonga|Tongan|National ID|Identity)";
  protected readonly labelStrings = [
    "Tonga",
    "Tongan",
    "National ID",
    "Identity",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  // A letters-only word next to a label ("National ID: passport") is prose.
  protected override validate(candidate: string): false | readonly string[] {
    if (!/\d/.test(candidate)) {
      return false;
    }

    return ["to_id.format"];
  }

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );
}

export const toIdDetector = new ToIdDetector();
