import { ContextDetector, streamMeta } from "../base";

export class NzIrdExtraDetector extends ContextDetector {
  readonly id = "nz_ird_extra";
  readonly entityType = "nz_ird_extra";
  readonly replacement = "[NZ_IRD_EXTRA]";

  protected readonly pattern = /\d{8,9}/g;
  protected readonly contextLabels =
    "(?:New Zealand|NZ|IRD|Tax|Inland Revenue)";
  protected readonly labelStrings = [
    "New Zealand",
    "NZ",
    "IRD",
    "Tax",
    "Inland Revenue",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(9, this.leftContext, this.rightContext);
}

export const nzIrdExtraDetector = new NzIrdExtraDetector();
