import { KeywordDetector } from "../base";

export class ScalewayKeyDetector extends KeywordDetector {
  readonly id = "scaleway_key";
  readonly entityType = "scaleway_key";
  readonly replacement = "[SCALEWAY_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 36,
    leftContext: 40,
    rightContext: 40,
    boundaryLookaround: 1,
  });

  protected readonly pattern =
    /[0-9a-z]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[0-9a-z]{4}-[0-9a-z]{12}/;
  protected readonly keywords = ["scaleway"] as const;
}

export const scalewayKeyDetector = new ScalewayKeyDetector();
