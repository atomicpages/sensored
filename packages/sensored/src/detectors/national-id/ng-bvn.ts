import { ContextDetector, streamMeta } from "../base";

export class NgBvnDetector extends ContextDetector {
  readonly id = "ng_bvn";
  readonly entityType = "ng_bvn";
  readonly replacement = "[NG_BVN]";

  protected readonly pattern = /\d{11}/g;
  protected readonly contextLabels =
    "(?:BVN|Bank Verification|Nigeria|Nigerian|Banking)";
  protected readonly labelStrings = [
    "BVN",
    "Bank Verification",
    "Nigeria",
    "Nigerian",
    "Banking",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );
}

export const ngBvnDetector = new NgBvnDetector();
