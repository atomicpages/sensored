import { ContextDetector, streamMeta } from "../base";

export class JoIdDetector extends ContextDetector {
  readonly id = "jo_id";
  readonly entityType = "jo_id";
  readonly replacement = "[JO_ID]";

  protected readonly pattern = /\d{10}/g;
  protected readonly contextLabels = "(?:Jordan|Amman|National ID|Jordanian)";
  protected readonly labelStrings = [
    "Jordan",
    "Amman",
    "National ID",
    "Jordanian",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );
}

export const joIdDetector = new JoIdDetector();
