import { ContextDetector, streamMeta } from "../base";

export class OmIdDetector extends ContextDetector {
  readonly id = "om_id";
  readonly entityType = "om_id";
  readonly replacement = "[OM_ID]";

  protected readonly pattern = /\d{8}/g;
  protected readonly contextLabels = "(?:Oman|Muscat|Civil ID|National ID)";
  protected readonly labelStrings = [
    "Oman",
    "Muscat",
    "Civil ID",
    "National ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);
}

export const omIdDetector = new OmIdDetector();
