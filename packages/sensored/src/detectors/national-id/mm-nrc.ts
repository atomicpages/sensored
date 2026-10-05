import { ContextDetector, streamMeta } from "../base";

export class MmNrcDetector extends ContextDetector {
  readonly id = "mm_nrc";
  readonly entityType = "mm_nrc";
  readonly replacement = "[MM_NRC]";

  protected readonly pattern = /\d{1,2}\/[A-Z][a-z]+\([NC]\)\d{6}/g;
  protected readonly contextLabels =
    "(?:Myanmar|Burmese|NRC|National Registration|Identity)";
  protected readonly labelStrings = [
    "Myanmar",
    "Burmese",
    "NRC",
    "National Registration",
    "Identity",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    20,
    this.leftContext,
    this.rightContext,
  );
}

export const mmNrcDetector = new MmNrcDetector();
