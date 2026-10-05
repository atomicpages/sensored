import type { Detection } from "../../types";
import { Detector } from "../base";

export class CryptoAddressDetector extends Detector {
  readonly id = "crypto_address";
  readonly entityType = "crypto_address";
  readonly replacement = "[CRYPTO_ADDRESS]";

  override readonly stream = Object.freeze({
    maxMatchLength: 95,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  #pattern =
    /(?:1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59}|0x[a-fA-F0-9]{40}|[LM][a-km-zA-HJ-NP-Z1-9]{25,34}|ltc1[a-z0-9]{39,59}|[48][a-km-zA-HJ-NP-Z1-9]{93}|r[a-km-zA-HJ-NP-Z1-9]{23,34}|addr1[a-z0-9]{50,120}|[1-9A-HJ-NP-Za-km-z]{32,44}|[1-9A-HJ-NP-Za-km-z]{46,48}|cosmos1[a-z0-9]{38}|[A-Z2-7]{58}|tz[1-4][a-km-zA-HJ-NP-Z1-9]{33}|KT1[a-km-zA-HJ-NP-Z1-9]{33}|bnb1[a-z0-9]{38})/g;

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(this.#pattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "crypto_address",
        entityType: "crypto_address",
        reasons: ["crypto_address.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const cryptoAddressDetector = new CryptoAddressDetector();
