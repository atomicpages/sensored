import { ContextDetector, streamMeta } from "../base";

export class LegalReferenceDetector extends ContextDetector {
  readonly id = "legal_reference";
  readonly entityType = "legal_reference";
  readonly replacement = "[LEGAL_REFERENCE]";

  protected readonly pattern = /[A-Z0-9]{6,15}/gi;
  protected readonly contextLabels =
    "(?:Matter|Engagement|Client|Settlement|Agreement|Retainer|NDA|Confidentiality|Non-Disclosure|Contract|CNTR|Legal|Law Firm|Attorney|Counsel)(?:[- \\t]{1,8}(?:No|ID|Agreement)\\.?)?";
  protected readonly labelStrings = [
    "Matter",
    "Matter No.",
    "Matter No",
    "Matter ID.",
    "Matter ID",
    "Matter Agreement.",
    "Matter Agreement",
    "Engagement",
    "Engagement No.",
    "Engagement No",
    "Engagement ID.",
    "Engagement ID",
    "Engagement Agreement.",
    "Engagement Agreement",
    "Client",
    "Client No.",
    "Client No",
    "Client ID.",
    "Client ID",
    "Client Agreement.",
    "Client Agreement",
    "Settlement",
    "Settlement No.",
    "Settlement No",
    "Settlement ID.",
    "Settlement ID",
    "Settlement Agreement.",
    "Settlement Agreement",
    "Agreement",
    "Agreement No.",
    "Agreement No",
    "Agreement ID.",
    "Agreement ID",
    "Agreement Agreement.",
    "Agreement Agreement",
    "Retainer",
    "Retainer No.",
    "Retainer No",
    "Retainer ID.",
    "Retainer ID",
    "Retainer Agreement.",
    "Retainer Agreement",
    "NDA",
    "NDA No.",
    "NDA No",
    "NDA ID.",
    "NDA ID",
    "NDA Agreement.",
    "NDA Agreement",
    "Confidentiality",
    "Confidentiality No.",
    "Confidentiality No",
    "Confidentiality ID.",
    "Confidentiality ID",
    "Confidentiality Agreement.",
    "Confidentiality Agreement",
    "Non-Disclosure",
    "Non-Disclosure No.",
    "Non-Disclosure No",
    "Non-Disclosure ID.",
    "Non-Disclosure ID",
    "Non-Disclosure Agreement.",
    "Non-Disclosure Agreement",
    "Contract",
    "Contract No.",
    "Contract No",
    "Contract ID.",
    "Contract ID",
    "Contract Agreement.",
    "Contract Agreement",
    "CNTR",
    "CNTR No.",
    "CNTR No",
    "CNTR ID.",
    "CNTR ID",
    "CNTR Agreement.",
    "CNTR Agreement",
    "Legal",
    "Legal No.",
    "Legal No",
    "Legal ID.",
    "Legal ID",
    "Legal Agreement.",
    "Legal Agreement",
    "Law Firm",
    "Law Firm No.",
    "Law Firm No",
    "Law Firm ID.",
    "Law Firm ID",
    "Law Firm Agreement.",
    "Law Firm Agreement",
    "Attorney",
    "Attorney No.",
    "Attorney No",
    "Attorney ID.",
    "Attorney ID",
    "Attorney Agreement.",
    "Attorney Agreement",
    "Counsel",
    "Counsel No.",
    "Counsel No",
    "Counsel ID.",
    "Counsel ID",
    "Counsel Agreement.",
    "Counsel Agreement",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    15,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!/\d/.test(candidate)) {
      return false;
    }

    return ["legal_reference.format"];
  }
}

export const legalReferenceDetector = new LegalReferenceDetector();
