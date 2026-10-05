import { ContextDetector, streamMeta } from "../base";

export class PhUmidDetector extends ContextDetector {
  readonly id = "ph_umid";
  readonly entityType = "ph_umid";
  readonly replacement = "[PH_UMID]";

  protected readonly pattern = /\d{4}[-\s]?\d{7}[-\s]?\d/g;
  protected readonly contextLabels =
    "(?:Philippines|Filipino|UMID|Unified|Multipurpose|National ID)";
  protected readonly labelStrings = [
    "Philippines",
    "Filipino",
    "UMID",
    "Unified",
    "Multipurpose",
    "National ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    14,
    this.leftContext,
    this.rightContext,
  );
}

export const phUmidDetector = new PhUmidDetector();
