import type { Detection } from "../../types";
import { Detector } from "../base";

const gitlabTokenPattern = /glpat-[a-zA-Z0-9\-=_]{20,22}/g;

export class GitLabTokenDetector extends Detector {
  readonly id = "gitlab_token";
  readonly entityType = "gitlab_token";
  readonly replacement = "[GITLAB_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 30,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(gitlabTokenPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "gitlab_token",
        entityType: "gitlab_token",
        reasons: ["gitlab_token.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const gitLabTokenDetector = new GitLabTokenDetector();
