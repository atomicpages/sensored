import { ContextDetector, streamMeta } from "../base";

export class UsItinDetector extends ContextDetector {
  readonly id = "us_itin";
  readonly entityType = "us_itin";
  readonly replacement = "[US_ITIN]";

  protected readonly pattern = /9\d{2}[- ]?(?:7\d|8[0-8])[- ]?\d{4}/g;
  protected readonly contextLabels =
    "(?:itin|individual[- ]?taxpayer[- ]?(?:id|identification)[- ]?(?:no\\.?|number)?|tax[- ]?id)";
  protected readonly labelStrings = [
    "itin",
    "individual taxpayer id",
    "individual taxpayer id no.",
    "individual taxpayer id no",
    "individual taxpayer id number",
    "individual taxpayer identification",
    "individual taxpayer identification no.",
    "individual taxpayer identification no",
    "individual taxpayer identification number",
    "tax id",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 40;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );
}

export const usItinDetector = new UsItinDetector();
