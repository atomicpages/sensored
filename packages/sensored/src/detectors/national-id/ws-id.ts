import { ContextDetector, streamMeta } from "../base";

export class WsIdDetector extends ContextDetector {
  readonly id = "ws_id";
  readonly entityType = "ws_id";
  readonly replacement = "[WS_ID]";

  protected readonly pattern = /\d{8,10}/g;
  protected readonly contextLabels = "(?:Samoa|Samoan|National ID|Identity)";
  protected readonly labelStrings = [
    "Samoa",
    "Samoan",
    "National ID",
    "Identity",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );
}

export const wsIdDetector = new WsIdDetector();
