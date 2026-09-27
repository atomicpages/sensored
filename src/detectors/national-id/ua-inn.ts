import { ContextDetector, streamMeta } from "../base";

export class UaInnDetector extends ContextDetector {
  readonly id = "ua_inn";
  readonly entityType = "ua_inn";
  readonly replacement = "[UA_INN]";

  protected readonly pattern = /\d{10}/g;
  protected readonly contextLabels = "(?:Ukrainian|INN|Tax|Податковий|ІНН)";
  protected readonly labelStrings = [
    "Ukrainian",
    "INN",
    "Tax",
    "Податковий",
    "ІНН",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );
}

export const uaInnDetector = new UaInnDetector();
