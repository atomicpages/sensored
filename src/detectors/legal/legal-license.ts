import { ContextDetector, streamMeta } from "../base";

export class LegalLicenseDetector extends ContextDetector {
  readonly id = "legal_license";
  readonly entityType = "legal_license";
  readonly replacement = "[LEGAL_LICENSE]";

  protected readonly pattern = /[A-Z0-9][-A-Z0-9]{4,11}/gi;
  protected readonly contextLabels =
    "(?:Bar|Attorney|Lawyer|Notary|Notarial|Court Reporter|CSR|RPR|License|Commission|Legal|Law Firm)(?:[- \\t]{1,8}(?:No|License|Registration|Commission)\\.?)?";
  protected readonly labelStrings = [
    "Bar",
    "Bar No.",
    "Bar No",
    "Bar License.",
    "Bar License",
    "Bar Registration.",
    "Bar Registration",
    "Bar Commission.",
    "Bar Commission",
    "Attorney",
    "Attorney No.",
    "Attorney No",
    "Attorney License.",
    "Attorney License",
    "Attorney Registration.",
    "Attorney Registration",
    "Attorney Commission.",
    "Attorney Commission",
    "Lawyer",
    "Lawyer No.",
    "Lawyer No",
    "Lawyer License.",
    "Lawyer License",
    "Lawyer Registration.",
    "Lawyer Registration",
    "Lawyer Commission.",
    "Lawyer Commission",
    "Notary",
    "Notary No.",
    "Notary No",
    "Notary License.",
    "Notary License",
    "Notary Registration.",
    "Notary Registration",
    "Notary Commission.",
    "Notary Commission",
    "Notarial",
    "Notarial No.",
    "Notarial No",
    "Notarial License.",
    "Notarial License",
    "Notarial Registration.",
    "Notarial Registration",
    "Notarial Commission.",
    "Notarial Commission",
    "Court Reporter",
    "Court Reporter No.",
    "Court Reporter No",
    "Court Reporter License.",
    "Court Reporter License",
    "Court Reporter Registration.",
    "Court Reporter Registration",
    "Court Reporter Commission.",
    "Court Reporter Commission",
    "CSR",
    "CSR No.",
    "CSR No",
    "CSR License.",
    "CSR License",
    "CSR Registration.",
    "CSR Registration",
    "CSR Commission.",
    "CSR Commission",
    "RPR",
    "RPR No.",
    "RPR No",
    "RPR License.",
    "RPR License",
    "RPR Registration.",
    "RPR Registration",
    "RPR Commission.",
    "RPR Commission",
    "License",
    "License No.",
    "License No",
    "License License.",
    "License License",
    "License Registration.",
    "License Registration",
    "License Commission.",
    "License Commission",
    "Commission",
    "Commission No.",
    "Commission No",
    "Commission License.",
    "Commission License",
    "Commission Registration.",
    "Commission Registration",
    "Commission Commission.",
    "Commission Commission",
    "Legal",
    "Legal No.",
    "Legal No",
    "Legal License.",
    "Legal License",
    "Legal Registration.",
    "Legal Registration",
    "Legal Commission.",
    "Legal Commission",
    "Law Firm",
    "Law Firm No.",
    "Law Firm No",
    "Law Firm License.",
    "Law Firm License",
    "Law Firm Registration.",
    "Law Firm Registration",
    "Law Firm Commission.",
    "Law Firm Commission",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    12,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!/\d/.test(candidate)) {
      return false;
    }

    return ["legal_license.format"];
  }
}

export const legalLicenseDetector = new LegalLicenseDetector();
