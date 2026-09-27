import { ContextDetector, streamMeta } from "../base";

export class LegalCaseDetector extends ContextDetector {
  readonly id = "legal_case";
  readonly entityType = "legal_case";
  readonly replacement = "[LEGAL_CASE]";

  protected readonly pattern = /[A-Z0-9][-A-Z0-9]{5,15}/gi;
  protected readonly contextLabels =
    "(?:Case|Docket|Court|Subpoena|Summons|Judgment|Order|Decree|Bankruptcy|BK|Probate|Estate|Legal|Lawsuit)(?:[- \\t]{1,8}No\\.?)?";
  protected readonly labelStrings = [
    "Case",
    "Case No.",
    "Case No",
    "Docket",
    "Docket No.",
    "Docket No",
    "Court",
    "Court No.",
    "Court No",
    "Subpoena",
    "Subpoena No.",
    "Subpoena No",
    "Summons",
    "Summons No.",
    "Summons No",
    "Judgment",
    "Judgment No.",
    "Judgment No",
    "Order",
    "Order No.",
    "Order No",
    "Decree",
    "Decree No.",
    "Decree No",
    "Bankruptcy",
    "Bankruptcy No.",
    "Bankruptcy No",
    "BK",
    "BK No.",
    "BK No",
    "Probate",
    "Probate No.",
    "Probate No",
    "Estate",
    "Estate No.",
    "Estate No",
    "Legal",
    "Legal No.",
    "Legal No",
    "Lawsuit",
    "Lawsuit No.",
    "Lawsuit No",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    16,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!/\d/.test(candidate)) {
      return false;
    }

    return ["legal_case.format"];
  }
}

export const legalCaseDetector = new LegalCaseDetector();
