import { ContextDetector, streamMeta } from "../base";

export class UaeIdDetector extends ContextDetector {
  readonly id = "uae_id";
  readonly entityType = "uae_id";
  readonly replacement = "[UAE_ID]";

  protected readonly pattern = /784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d|784\d{12}/g;
  protected readonly contextLabels =
    "(?:UAE|Emirates|Dubai|Abu Dhabi|National ID|Emirates ID)";
  protected readonly labelStrings = [
    "UAE",
    "Emirates",
    "Dubai",
    "Abu Dhabi",
    "National ID",
    "Emirates ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    18,
    this.leftContext,
    this.rightContext,
  );
}

export const uaeIdDetector = new UaeIdDetector();
