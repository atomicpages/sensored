import { ContextDetector, streamMeta } from "../base";

export class MedicalReferenceDetector extends ContextDetector {
  readonly id = "medical_reference";
  readonly entityType = "medical_reference";
  readonly replacement = "[MEDICAL_REFERENCE]";

  protected readonly pattern =
    /(?:LAB|TEST|SAMPLE)[-\s]?(?:ID|NUM(?:BER)?|REF)?[-\s]?[:#]?\s*[A-Z0-9]{6,12}|(?:RX|PRESC(?:RIPTION)?|SCRIPT)[-\s]?(?:NO|NUM(?:BER)?|REF|ID)?[-\s]?[:#]?\s*[A-Z0-9]{6,12}|(?:VACCINE|VACCINATION|IMMUNIZATION)[-\s]?(?:ID|RECORD|NO)?[-\s]?[:#]?\s*[A-Z0-9]{6,15}/gi;
  protected readonly contextLabels =
    "(?:Lab|Test|Sample|Specimen|Pathology|Prescription|RX|Vaccine|Vaccination|Immunization)";
  protected readonly labelStrings = [
    "Lab",
    "Test",
    "Sample",
    "Specimen",
    "Pathology",
    "Prescription",
    "RX",
    "Vaccine",
    "Vaccination",
    "Immunization",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    30,
    this.leftContext,
    this.rightContext,
  );
}

export const medicalReferenceDetector = new MedicalReferenceDetector();
