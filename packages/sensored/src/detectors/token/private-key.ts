import type { Detection } from "../../types";
import { Detector } from "../base";

const privateKeyPattern =
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]{20,}?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g;

export class PrivateKeyDetector extends Detector {
  readonly id = "private_key";
  readonly entityType = "private_key";
  readonly replacement = "[PRIVATE_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 65536,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(privateKeyPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "private_key",
        entityType: "private_key",
        reasons: ["private_key.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const privateKeyDetector = new PrivateKeyDetector();
