import { ContextDetector, streamMeta } from "../base";

export class KeIdDetector extends ContextDetector {
  readonly id = "ke_id";
  readonly entityType = "ke_id";
  readonly replacement = "[KE_ID]";

  protected readonly pattern = /\d{7,8}/g;
  protected readonly contextLabels = "(?:Kenya|Kenyan|National ID|Identity)";
  protected readonly labelStrings = [
    "Kenya",
    "Kenyan",
    "National ID",
    "Identity",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);
}

export const keIdDetector = new KeIdDetector();
