import { ContextDetector, streamMeta } from "../base";

export class HuIdDetector extends ContextDetector {
  readonly id = "hu_id";
  readonly entityType = "hu_id";
  readonly replacement = "[HU_ID]";

  protected readonly pattern = /\d{6}[A-Z]{2}/g;
  protected readonly contextLabels =
    "(?:Hungarian|Magyar|Személyi|Igazolvány|Personal ID)";
  protected readonly labelStrings = [
    "Hungarian",
    "Magyar",
    "Személyi",
    "Igazolvány",
    "Personal ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);
}

export const huIdDetector = new HuIdDetector();
