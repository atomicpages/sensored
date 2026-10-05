import type { Detection } from "../../types";
import { Detector } from "../base";

const awsKeyPattern = /AKIA[0-9A-Z]{16}/g;

export class AwsAccessKeyDetector extends Detector {
  readonly id = "aws_access_key";
  readonly entityType = "aws_access_key";
  readonly replacement = "[AWS_ACCESS_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 20,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(awsKeyPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "aws_access_key",
        entityType: "aws_access_key",
        reasons: ["aws_access_key.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const awsAccessKeyDetector = new AwsAccessKeyDetector();
