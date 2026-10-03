import { KeywordDetector } from "../base";

export class SquareTokenDetector extends KeywordDetector {
  readonly id = "square_token";
  readonly entityType = "square_token";
  readonly replacement = "[SQUARE_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 64,
    leftContext: 40,
    rightContext: 40,
    boundaryLookaround: 1,
  });

  protected readonly pattern =
    /EAAA[a-zA-Z0-9\-+=]{60}|sq0atp-[a-zA-Z0-9_-]{36}|sq0csp-[a-zA-Z0-9_-]{43}/;
  protected readonly keywords = ["square"] as const;
}

export const squareTokenDetector = new SquareTokenDetector();
