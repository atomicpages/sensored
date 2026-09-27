import { ContextDetector, streamMeta } from "../base";

export class GeneticInfoDetector extends ContextDetector {
  readonly id = "genetic_info";
  readonly entityType = "genetic_info";
  readonly replacement = "[GENETIC_INFO]";

  protected readonly pattern = /rs\d{6,10}|[ATCG]{20,}/gi;
  protected readonly contextLabels =
    "(?:Genetic|Gene|SNP|Marker|Genome|DNA|Variant|Allele|Sequence|Nucleotide)";
  protected readonly labelStrings = [
    "Genetic",
    "Gene",
    "SNP",
    "Marker",
    "Genome",
    "DNA",
    "Variant",
    "Allele",
    "Sequence",
    "Nucleotide",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    100,
    this.leftContext,
    this.rightContext,
  );
}

export const geneticInfoDetector = new GeneticInfoDetector();
