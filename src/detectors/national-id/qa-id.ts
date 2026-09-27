import { ContextDetector, streamMeta } from "../base";

export class QaIdDetector extends ContextDetector {
  readonly id = "qa_id";
  readonly entityType = "qa_id";
  readonly replacement = "[QA_ID]";

  protected readonly pattern = /\d{11}/g;
  protected readonly contextLabels =
    "(?:Qatar|QID|Doha|National ID|Resident Permit)";
  protected readonly labelStrings = [
    "Qatar",
    "QID",
    "Doha",
    "National ID",
    "Resident Permit",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );
}

export const qaIdDetector = new QaIdDetector();
