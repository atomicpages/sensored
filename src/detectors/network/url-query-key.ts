import type { Detection } from "../../types";
import { Detector } from "../base";

const urlQueryKeyPattern =
  /[?&](?:api_key|api-key|apikey|api_token|api-token|apitoken|access_token|access-token|accesstoken|auth_token|auth-token|authtoken|access_key|access-key|accesskey|secret_key|secret-key|secretkey|secret|private_key|private-key|privatekey|oauth_token|oauth-token|oauthtoken)=([^&#\s]+)/gi;

export class UrlQueryKeyDetector extends Detector {
  readonly id = "url_query_key";
  readonly entityType = "url_query_key";
  readonly replacement = "[URL_QUERY_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 8192,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(urlQueryKeyPattern)) {
      const value = match[1];

      if (value === undefined) {
        continue;
      }

      const valueStart = match.index! + match[0].indexOf(value);
      const valueEnd = valueStart + value.length;

      if (this.isAdjacentForbidden(text, valueStart, valueEnd)) {
        continue;
      }

      candidates.push({
        start: valueStart,
        end: valueEnd,
        ruleId: "url_query_key",
        entityType: "url_query_key",
        reasons: ["url_query_key.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const urlQueryKeyDetector = new UrlQueryKeyDetector();
