import { ContextDetector, streamMeta } from "../base";

export class TrIdDetector extends ContextDetector {
  readonly id = "tr_id";
  readonly entityType = "tr_id";
  readonly replacement = "[TR_ID]";

  protected readonly pattern = /[1-9]\d{10}/g;
  protected readonly contextLabels = "(?:Turkey|Turkish|TC|Kimlik|National ID)";
  protected readonly labelStrings = [
    "Turkey",
    "Turkish",
    "TC",
    "Kimlik",
    "National ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );
}

export const trIdDetector = new TrIdDetector();
