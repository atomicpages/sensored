import { ContextDetector, streamMeta } from "../base";

export class UkSortCodeDetector extends ContextDetector {
  readonly id = "uk_sort_code";
  readonly entityType = "uk_sort_code";
  readonly replacement = "[UK_SORT_CODE]";

  protected readonly pattern = /\d{2}[- ]\d{2}[- ]\d{2}/g;
  protected readonly contextLabels =
    "(?:sort[- ]?code|sort|branch[- ]?code|bank[- ]?code)";
  protected readonly labelStrings = [
    "sort code",
    "sort",
    "branch code",
    "bank code",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 40;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);
}

export const ukSortCodeDetector = new UkSortCodeDetector();
