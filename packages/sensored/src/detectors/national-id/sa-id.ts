import { ContextDetector, streamMeta } from "../base";

export class SaIdDetector extends ContextDetector {
  readonly id = "sa_id";
  readonly entityType = "sa_id";
  readonly replacement = "[SA_ID]";

  protected readonly pattern = /[12]\d{9}/g;
  protected readonly contextLabels =
    "(?:Saudi|KSA|Kingdom|Iqama|National ID|Muqeem)";
  protected readonly labelStrings = [
    "Saudi",
    "KSA",
    "Kingdom",
    "Iqama",
    "National ID",
    "Muqeem",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );
}

export const saIdDetector = new SaIdDetector();
