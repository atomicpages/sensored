import { ContextDetector, streamMeta } from "../base";

export class FjIdDetector extends ContextDetector {
  readonly id = "fj_id";
  readonly entityType = "fj_id";
  readonly replacement = "[FJ_ID]";

  protected readonly pattern = /[A-Z0-9]{8,10}/gi;
  protected readonly contextLabels = "(?:Fiji|Fijian|National ID|Identity)";
  protected readonly labelStrings = [
    "Fiji",
    "Fijian",
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

export const fjIdDetector = new FjIdDetector();
