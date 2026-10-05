import { ContextDetector, streamMeta } from "../base";

export class HrScreeningDetector extends ContextDetector {
  readonly id = "hr_screening";
  readonly entityType = "hr_screening";
  readonly replacement = "[HR_SCREENING]";

  protected readonly pattern = /[A-Z0-9]{7,14}/gi;
  protected readonly contextLabels =
    "(?:Background Check ID|BGC ID|Screening ID|Drug Test ID|Urinalysis ID|Disciplinary Action No|Incident No|Warning No|Violation No|Background Check|BGC|Screening|Drug Test|Urinalysis|Disciplinary|Incident|Warning|Violation)";
  protected readonly labelStrings = [
    "Background Check ID",
    "BGC ID",
    "Screening ID",
    "Drug Test ID",
    "Urinalysis ID",
    "Disciplinary Action No",
    "Incident No",
    "Warning No",
    "Violation No",
    "Background Check",
    "BGC",
    "Screening",
    "Drug Test",
    "Urinalysis",
    "Disciplinary",
    "Incident",
    "Warning",
    "Violation",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    25,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!/\d/.test(candidate)) {
      return false;
    }

    return ["hr_screening.format"];
  }
}

export const hrScreeningDetector = new HrScreeningDetector();
