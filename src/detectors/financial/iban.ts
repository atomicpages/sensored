import type { Detection } from "../../types";
import { Detector } from "../base";

const sepaCountryLengths: Record<string, number> = {
  AT: 20,
  BE: 16,
  BG: 22,
  CH: 21,
  CY: 28,
  CZ: 24,
  DE: 22,
  DK: 18,
  EE: 20,
  ES: 24,
  FI: 18,
  FR: 27,
  GB: 22,
  GR: 27,
  HR: 21,
  HU: 28,
  IE: 22,
  IS: 26,
  IT: 27,
  LI: 21,
  LT: 20,
  LU: 20,
  LV: 21,
  MC: 27,
  MT: 31,
  NL: 18,
  NO: 15,
  PL: 28,
  PT: 25,
  RO: 24,
  SE: 24,
  SI: 19,
  SK: 24,
};

function mod97Valid(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let numeric = "";

  for (let i = 0; i < rearranged.length; i++) {
    const ch = rearranged[i]!;

    if (ch >= "0" && ch <= "9") {
      numeric += ch;
    } else {
      numeric += (ch.charCodeAt(0) - 55).toString();
    }
  }

  return BigInt(numeric) % 97n === 1n;
}

function isValidIban(candidate: string): boolean {
  const iban = candidate.replace(/ /g, "");

  if (iban.length < 15 || iban.length > 34) {
    return false;
  }

  const countryCode = iban.slice(0, 2);
  const expectedLength = sepaCountryLengths[countryCode];

  if (expectedLength === undefined || iban.length !== expectedLength) {
    return false;
  }

  return mod97Valid(iban);
}

export class IbanDetector extends Detector {
  readonly id = "iban";
  readonly entityType = "iban";
  readonly replacement = "[IBAN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 38,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(/[A-Z]{2}\d{2}(?: ?[A-Z0-9]{1,4})+/g)) {
      const matchStart = match.index;

      if (this.isStartForbidden(text, matchStart)) {
        continue;
      }

      let candidate = match[0];
      let end = matchStart + candidate.length;

      while (candidate.length > 0) {
        if (isValidIban(candidate)) {
          if (this.isEndForbidden(text, end)) {
            break;
          }

          candidates.push({
            start: matchStart,
            end,
            ruleId: "iban",
            entityType: "iban",
            reasons: ["iban.checksum", "iban.format"],
          });
          break;
        }

        const lastSpace = candidate.lastIndexOf(" ");

        if (lastSpace === -1) {
          break;
        }

        const removed = candidate.slice(lastSpace + 1);

        if (/^\d+$/.test(removed)) {
          break;
        }

        candidate = candidate.slice(0, lastSpace);
        end = matchStart + candidate.length;
      }
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const ibanDetector = new IbanDetector();
