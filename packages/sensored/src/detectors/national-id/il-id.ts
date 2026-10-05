import { ContextDetector, streamMeta } from "../base";

export class IlIdDetector extends ContextDetector {
  readonly id = "il_id";
  readonly entityType = "il_id";
  readonly replacement = "[IL_ID]";

  protected readonly pattern = /\d{9}/g;
  protected readonly contextLabels =
    "(?:Israel|Teudat|Zehut|Israeli|National ID)";
  protected readonly labelStrings = [
    "Israel",
    "Teudat",
    "Zehut",
    "Israeli",
    "National ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(9, this.leftContext, this.rightContext);
}

export const ilIdDetector = new IlIdDetector();
