import { ContextDetector, streamMeta } from "../base";

export class TjIdDetector extends ContextDetector {
  readonly id = "tj_id";
  readonly entityType = "tj_id";
  readonly replacement = "[TJ_ID]";

  protected readonly pattern = /\d{9,10}/g;
  protected readonly contextLabels =
    "(?:Tajik|Tajikistan|National ID|Identity)";
  protected readonly labelStrings = [
    "Tajik",
    "Tajikistan",
    "National ID",
    "Identity",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );
}

export const tjIdDetector = new TjIdDetector();
