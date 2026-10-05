import { ContextDetector, streamMeta } from "../base";

export class HrRecruitmentDetector extends ContextDetector {
  readonly id = "hr_recruitment";
  readonly entityType = "hr_recruitment";
  readonly replacement = "[HR_RECRUITMENT]";

  protected readonly pattern = /[A-Z0-9]{7,14}/gi;
  protected readonly contextLabels =
    "(?:Application ID|Candidate ID|Applicant No|Application Ref|Resume ID|CV No|Curriculum Vitae No|Performance ID|Review ID|Appraisal No|Evaluation ID|Training ID|Certification ID|Cert No|Recruiter Ref|Agency ID|Application|Candidate|Applicant|Resume|CV|Curriculum Vitae|Performance|Review|Appraisal|Evaluation|Training|Certification|Cert|Recruiter|Agency)";
  protected readonly labelStrings = [
    "Application ID",
    "Candidate ID",
    "Applicant No",
    "Application Ref",
    "Resume ID",
    "CV No",
    "Curriculum Vitae No",
    "Performance ID",
    "Review ID",
    "Appraisal No",
    "Evaluation ID",
    "Training ID",
    "Certification ID",
    "Cert No",
    "Recruiter Ref",
    "Agency ID",
    "Application",
    "Candidate",
    "Applicant",
    "Resume",
    "CV",
    "Curriculum Vitae",
    "Performance",
    "Review",
    "Appraisal",
    "Evaluation",
    "Training",
    "Certification",
    "Cert",
    "Recruiter",
    "Agency",
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

    return ["hr_recruitment.format"];
  }
}

export const hrRecruitmentDetector = new HrRecruitmentDetector();
