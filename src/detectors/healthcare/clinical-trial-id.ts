import { ContextDetector, streamMeta } from "../base";

export class ClinicalTrialIdDetector extends ContextDetector {
  readonly id = "clinical_trial_id";
  readonly entityType = "clinical_trial_id";
  readonly replacement = "[CLINICAL_TRIAL_ID]";

  protected readonly pattern =
    /(?:PARTICIPANT|SUBJECT|TRIAL)[-\s]?(?:ID|NO|NUM(?:BER)?)?[-\s]?[:#]?\s*[A-Z]{1,2}[-]?\d{4,6}|(?:PROTOCOL|STUDY)[-\s]?(?:NO|NUM(?:BER)?|ID)?[-\s]?[:#]?\s*[A-Z0-9]{6,15}/gi;
  protected readonly contextLabels =
    "(?:Trial|Study|Protocol|Research|Clinical|Participant|Subject)";
  protected readonly labelStrings = [
    "Trial",
    "Study",
    "Protocol",
    "Research",
    "Clinical",
    "Participant",
    "Subject",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    25,
    this.leftContext,
    this.rightContext,
  );
}

export const clinicalTrialIdDetector = new ClinicalTrialIdDetector();
