import { ContextDetector, streamMeta } from "../base";

export class HealthInsuranceIdDetector extends ContextDetector {
  readonly id = "health_insurance_id";
  readonly entityType = "health_insurance_id";
  readonly replacement = "[HEALTH_INSURANCE_ID]";

  protected readonly pattern =
    /(?:CLAIM|CLM)[-\s]?(?:NO|NUM(?:BER)?|REF|ID)?[-\s]?[:#]?\s*[A-Z0-9]{8,16}|(?:HEALTH[-\s]?PLAN|BENEFICIARY|MEMBER)[-\s]?(?:NO|NUM(?:BER)?|ID)?[-\s]?[:#]?\s*[A-Z0-9]{8,15}/gi;
  protected readonly contextLabels =
    "(?:Insurance|Claim|Medical|Health|Policy|Plan|Beneficiary|Member)";
  protected readonly labelStrings = [
    "Insurance",
    "Claim",
    "Medical",
    "Health",
    "Policy",
    "Plan",
    "Beneficiary",
    "Member",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    30,
    this.leftContext,
    this.rightContext,
  );
}

export const healthInsuranceIdDetector = new HealthInsuranceIdDetector();
