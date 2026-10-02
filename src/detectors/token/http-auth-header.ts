import type { Detection } from "../../types";
import { escapeRegExp } from "../../utils";
import { Detector } from "../base";

const DEFAULT_ALTERNATIVES =
  "Authorization:\\s*(?:Basic|Bearer|Digest)\\s+|Proxy-Authorization:\\s*(?:Basic|Bearer|Digest)\\s+|X-[\\w-]*(?:Key|Token|Secret)\\s*:\\s*|Api-Key\\s*:\\s*|ApiKey\\s*:\\s*|Ocp-Apim-Subscription-Key\\s*:\\s*";

const DEFAULT_PATTERN_SOURCE = `(?:${DEFAULT_ALTERNATIVES})(\\S+)`;

const DEFAULT_PATTERN = new RegExp(DEFAULT_PATTERN_SOURCE, "gi");

export function buildHttpAuthHeaderPattern(
  customHeaders: readonly (string | RegExp)[],
): RegExp {
  const stringAlts = customHeaders
    .filter((h): h is string => typeof h === "string")
    .map((h) => `${escapeRegExp(h)}\\s*:\\s*`);

  const regexpAlts = customHeaders
    .filter((h): h is RegExp => h instanceof RegExp)
    .map((h) => h.source);

  const allStringAlts = [...stringAlts].join("|");
  const allRegexpAlts = [...regexpAlts].join("|");

  const parts: string[] = [];

  const stringPart = allStringAlts
    ? `(?:${DEFAULT_ALTERNATIVES}|${allStringAlts})(\\S+)`
    : DEFAULT_PATTERN_SOURCE;

  parts.push(stringPart);

  if (allRegexpAlts) {
    parts.push(allRegexpAlts);
  }

  return new RegExp(parts.join("|"), "gi");
}

export class HttpAuthHeaderDetector extends Detector {
  readonly id = "http_auth_header";
  readonly entityType = "http_auth_header";
  readonly replacement = "[HTTP_AUTH_HEADER]";

  override readonly stream = Object.freeze({
    maxMatchLength: 1024,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  private readonly pattern: RegExp;

  constructor(pattern?: RegExp) {
    super();
    this.pattern = pattern ?? DEFAULT_PATTERN;
  }

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(this.pattern)) {
      let value: string | undefined;

      for (let i = 1; i < match.length; i++) {
        if (match[i] !== undefined) {
          value = match[i];
          break;
        }
      }

      if (value === undefined) {
        continue;
      }

      const valueStart = match.index! + match[0].lastIndexOf(value);
      const valueEnd = valueStart + value.length;

      if (this.isAdjacentForbidden(text, valueStart, valueEnd)) {
        continue;
      }

      candidates.push({
        start: valueStart,
        end: valueEnd,
        ruleId: "http_auth_header",
        entityType: "http_auth_header",
        reasons: ["http_auth_header.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const httpAuthHeaderDetector = new HttpAuthHeaderDetector();

export { DEFAULT_PATTERN_SOURCE };
