import { ContextDetector, streamMeta } from "../base";

export class MaIdDetector extends ContextDetector {
  readonly id = "ma_id";
  readonly entityType = "ma_id";
  readonly replacement = "[MA_ID]";

  protected readonly pattern = /[A-Z]{1,2}\d{6,8}|\d{8}/g;
  protected readonly contextLabels =
    "(?:Morocco|Moroccan|CNIE|National ID|Identity)";
  protected readonly labelStrings = [
    "Morocco",
    "Moroccan",
    "CNIE",
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

export const maIdDetector = new MaIdDetector();
