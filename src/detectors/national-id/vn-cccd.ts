import { ContextDetector, streamMeta } from "../base";

export class VnCccdDetector extends ContextDetector {
  readonly id = "vn_cccd";
  readonly entityType = "vn_cccd";
  readonly replacement = "[VN_CCCD]";

  protected readonly pattern = /\d{12}/g;
  protected readonly contextLabels =
    "(?:Vietnam|Vietnamese|CCCD|Citizen Identity|CMND|National ID)";
  protected readonly labelStrings = [
    "Vietnam",
    "Vietnamese",
    "CCCD",
    "Citizen Identity",
    "CMND",
    "National ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    12,
    this.leftContext,
    this.rightContext,
  );
}

export const vnCccdDetector = new VnCccdDetector();
