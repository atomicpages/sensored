import { ContextDetector, streamMeta } from "../base";

export class HrIdentifierDetector extends ContextDetector {
  readonly id = "hr_identifier";
  readonly entityType = "hr_identifier";
  readonly replacement = "[HR_IDENTIFIER]";

  protected readonly pattern = /[A-Z]{0,3}\d{4,10}/gi;
  protected readonly contextLabels =
    "(?:Employee ID|EMP-ID|Staff No|Personnel ID|Worker ID|Payroll No|PAY ID|Timesheet No|Timecard ID|Time-Entry No)";
  protected readonly labelStrings = [
    "Employee ID",
    "EMP-ID",
    "Staff No",
    "Personnel ID",
    "Worker ID",
    "Payroll No",
    "PAY ID",
    "Timesheet No",
    "Timecard ID",
    "Time-Entry No",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    25,
    this.leftContext,
    this.rightContext,
  );
}

export const hrIdentifierDetector = new HrIdentifierDetector();
