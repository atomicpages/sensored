import { ContextDetector, streamMeta } from "../base";

export class UsEinDetector extends ContextDetector {
  readonly id = "us_ein";
  readonly entityType = "us_ein";
  readonly replacement = "[US_EIN]";

  protected readonly pattern = /\d{2}[- ]?\d{7}/g;
  protected readonly contextLabels =
    "(?:ein|employer[- ]?(?:id|identification)[- ]?(?:no\\.?|number)?|tax[- ]?id)";
  protected readonly labelStrings = [
    "ein",
    "employer id",
    "employer id no.",
    "employer id no",
    "employer id number",
    "employer identification",
    "employer identification no.",
    "employer identification no",
    "employer identification number",
    "tax id",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 40;

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );
}

export const usEinDetector = new UsEinDetector();
