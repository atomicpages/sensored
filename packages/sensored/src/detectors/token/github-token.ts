import type { Detection } from "../../types";
import { Detector } from "../base";

const githubTokenPattern = /gh[pousr]_[A-Za-z0-9]{36,}/g;

export class GitHubTokenDetector extends Detector {
  readonly id = "github_token";
  readonly entityType = "github_token";
  readonly replacement = "[GITHUB_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 255,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(githubTokenPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "github_token",
        entityType: "github_token",
        reasons: ["github_token.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const gitHubTokenDetector = new GitHubTokenDetector();
