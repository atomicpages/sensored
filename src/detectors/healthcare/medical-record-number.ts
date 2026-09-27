import { ContextDetector, streamMeta } from "../base";

export class MedicalRecordNumberDetector extends ContextDetector {
  readonly id = "medical_record_number";
  readonly entityType = "medical_record_number";
  readonly replacement = "[MEDICAL_RECORD_NUMBER]";

  protected readonly pattern = /[A-Z]{0,2}\d{4,16}/g;
  protected readonly contextLabels =
    "(?:mrn|medical[- ]?record[- ]?(?:no\\.?|number)|record[- ]?(?:no\\.?|number)|patient[- ]?id|chart[- ]?(?:no\\.?|number))";
  protected readonly labelStrings = [
    "mrn",
    "medical record no.",
    "medical record no",
    "medical record number",
    "record no.",
    "record no",
    "record number",
    "patient id",
    "chart no.",
    "chart no",
    "chart number",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 40;

  override readonly stream = streamMeta(
    18,
    this.leftContext,
    this.rightContext,
  );
}

export const medicalRecordNumberDetector = new MedicalRecordNumberDetector();
