import { ContextDetector, streamMeta } from "../base";

export class GhCardDetector extends ContextDetector {
  readonly id = "gh_card";
  readonly entityType = "gh_card";
  readonly replacement = "[GH_CARD]";

  protected readonly pattern = /GHA-\d{9}-\d/g;
  protected readonly contextLabels =
    "(?:Ghana|Ghanaian|Ghana Card|National ID|Identity)";
  protected readonly labelStrings = [
    "Ghana",
    "Ghanaian",
    "Ghana Card",
    "National ID",
    "Identity",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    15,
    this.leftContext,
    this.rightContext,
  );
}

export const ghCardDetector = new GhCardDetector();
