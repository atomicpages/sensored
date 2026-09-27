import { ContextDetector, streamMeta } from "../base";

export class LbIdDetector extends ContextDetector {
  readonly id = "lb_id";
  readonly entityType = "lb_id";
  readonly replacement = "[LB_ID]";

  protected readonly pattern = /\d{7,8}/g;
  protected readonly contextLabels = "(?:Lebanon|Lebanese|Beirut|National ID)";
  protected readonly labelStrings = [
    "Lebanon",
    "Lebanese",
    "Beirut",
    "National ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);
}

export const lbIdDetector = new LbIdDetector();
