import { ContextDetector, streamMeta } from "../base";

export class NgNinDetector extends ContextDetector {
  readonly id = "ng_nin";
  readonly entityType = "ng_nin";
  readonly replacement = "[NG_NIN]";

  protected readonly pattern = /\d{11}/g;
  protected readonly contextLabels =
    "(?:Nigeria|NIN|National ID|Identity|Nigerian)";
  protected readonly labelStrings = [
    "Nigeria",
    "NIN",
    "National ID",
    "Identity",
    "Nigerian",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );
}

export const ngNinDetector = new NgNinDetector();
