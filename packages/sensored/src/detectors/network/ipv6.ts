import type { Detection } from "../../types";
import { Detector } from "../base";

const group = "[0-9a-fA-F]{1,4}";

const ipv6Pattern = new RegExp(
  // Full form: 8 groups
  `(?:${group}:){7}${group}` +
    // IPv4-mapped: ::ffff:A.B.C.D
    `|::[fF]{4}:(?:\\d{1,3}\\.){3}\\d{1,3}` +
    // Compressed form: optional groups before ::, ::, optional groups after
    `|(?:${group}(?::${group})*)?::(?:${group}(?::${group})*)?`,
  "g",
);

const ipv4Tail = /(?:\d{1,3}\.){3}\d{1,3}$/;

function isValid(candidate: string): boolean {
  if (candidate === "::") {
    return false;
  }

  const doubleColonCount = (candidate.match(/::/g) ?? []).length;

  if (doubleColonCount > 1) {
    return false;
  }

  // Check for IPv4-mapped tail (e.g. ::ffff:192.0.2.1)
  const ipv4Match = candidate.match(ipv4Tail);
  let ipv4Groups = 0;
  let core = candidate;

  if (ipv4Match) {
    ipv4Groups = 2;
    core = candidate.slice(0, candidate.length - ipv4Match[0].length);

    // Remove trailing colon from core for group counting
    if (core.endsWith(":")) {
      core = core.slice(0, -1);
    }
  }

  const parts = core.split("::");
  let groupCount = 0;

  for (const part of parts) {
    if (part === "") {
      continue;
    }

    const groups = part.split(":");

    for (const g of groups) {
      if (g.length === 0 || g.length > 4) {
        return false;
      }

      groupCount++;
    }
  }

  groupCount += ipv4Groups;

  if (doubleColonCount === 0 && groupCount !== 8) {
    return false;
  }

  if (doubleColonCount === 1 && groupCount >= 8) {
    return false;
  }

  const lower = candidate.toLowerCase();

  if (lower === "::1") {
    return false;
  }

  if (lower.startsWith("fe80:")) {
    return false;
  }

  return true;
}

export class IPv6Detector extends Detector {
  readonly id = "ipv6";
  readonly entityType = "ipv6";
  readonly replacement = "[IPV6]";

  override readonly stream = Object.freeze({
    maxMatchLength: 39,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(ipv6Pattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      if (!isValid(match[0])) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "ipv6",
        entityType: "ipv6",
        reasons: ["ipv6.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const ipv6Detector = new IPv6Detector();
