import type { Detection } from "../../types";
import { Detector } from "../base";

const octet = /(?:25[0-5]|2[0-4]\d|[01]?\d\d?)/;

const ipv4Pattern = new RegExp(
  `${octet.source}\\.${octet.source}\\.${octet.source}\\.${octet.source}`,
  "g",
);

function isExcluded(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;

  if (ip === "0.0.0.0" || ip === "255.255.255.255") {
    return true;
  }

  if (a === 10) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 127) {
    return true;
  }

  return false;
}

export class IPv4Detector extends Detector {
  readonly id = "ipv4";
  readonly entityType = "ipv4";
  readonly replacement = "[IPV4]";

  override readonly stream = Object.freeze({
    maxMatchLength: 15,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(ipv4Pattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      if (isExcluded(match[0])) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "ipv4",
        entityType: "ipv4",
        reasons: ["ipv4.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const ipv4Detector = new IPv4Detector();
