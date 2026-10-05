import { ContextDetector, streamMeta } from "../base";

function isValidCpt(candidate: string): boolean {
  const num = Number.parseInt(candidate, 10);
  return num >= 100 && num <= 99499;
}

export class MedicalCodeDetector extends ContextDetector {
  readonly id = "medical_code";
  readonly entityType = "medical_code";
  readonly replacement = "[MEDICAL_CODE]";

  protected readonly pattern = /[A-TV-Z]\d{2}(\.\d{1,2})?|\d{5}/gi;
  protected readonly contextLabels =
    "(?:Diagnosis|Condition|Disease|Disorder|ICD|Code|Procedure|CPT|Billing|Treatment|Service)";
  protected readonly labelStrings = [
    "Diagnosis",
    "Condition",
    "Disease",
    "Disorder",
    "ICD",
    "Code",
    "Procedure",
    "CPT",
    "Billing",
    "Treatment",
    "Service",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);

  protected override validate(candidate: string): false | readonly string[] {
    if (/^\d{5}$/.test(candidate) && !isValidCpt(candidate)) {
      return false;
    }

    return ["medical_code.format"];
  }
}

export const medicalCodeDetector = new MedicalCodeDetector();
