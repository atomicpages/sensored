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

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );
}

export const toIdDetector = new ToIdDetector();
