import type { Detection } from "../../types";
import { Detector } from "../base";

const leftCharacter = /[a-zA-Z0-9.!#$%&'*+\-/=?^_`{|}~@\p{L}\p{M}\p{N}]/u;
const rightCharacter = /[a-zA-Z0-9._@\-\p{L}\p{M}\p{N}]/u;

const localGrammar =
  /^[a-zA-Z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[a-zA-Z0-9!#$%&'*+\-/=?^_`{|}~]+)*$/;

const domainGrammar =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

export class EmailDetector extends Detector {
  readonly id = "email";
  readonly entityType = "email";
  readonly replacement = "[EMAIL]";

  override readonly stream = Object.freeze({
    maxMatchLength: 254,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    // Pre-scan for quoted local parts so we can skip @ signs inside them.
    const quotedLocalSpans = [...text.matchAll(/"(?:[^"\\]|\\.)*"@/g)].map(
      (match) => ({ start: match.index, end: match.index + match[0].length }),
    );

    let quotedIndex = 0;

    for (
      let at = text.indexOf("@");
      at !== -1;
      at = text.indexOf("@", at + 1)
    ) {
      // Advance past quoted spans that end before this @.
      while (
        quotedIndex < quotedLocalSpans.length &&
        (quotedLocalSpans[quotedIndex]?.end ?? Infinity) <= at
      ) {
        quotedIndex++;
      }

      const quoted = quotedLocalSpans[quotedIndex];

      if (quoted && quoted.start < at && at < quoted.end) {
        continue;
      }

      // Skip @ signs that are part of a URL with embedded credentials
      // (e.g. https://user:password@host/path). If there is a "://" earlier
      // in the text and a ":" between it and this "@", the @ is likely a
      // URL credential separator, not an email delimiter.
      const schemePos = text.lastIndexOf("://", at);
      if (schemePos !== -1) {
        const between = text.slice(schemePos + 3, at);
        if (between.includes(":")) {
          continue;
        }
      }

      // Expand left from @ to find the local part boundary.
      let start = at;
      let end = at + 1;

      while (start > 0 && at - start <= 254) {
        const previous = text.charCodeAt(start - 1);
        const width =
          previous >= 0xdc00 && previous <= 0xdfff && start > 1 ? 2 : 1;

        if (!leftCharacter.test(text.slice(start - width, start))) {
          break;
        }

        start -= width;
      }

      // Expand right from @ to find the domain boundary.
      while (end < text.length && end - at <= 254) {
        const point = text.codePointAt(end);

        if (point === undefined) {
          break;
        }

        const character = String.fromCodePoint(point);

        if (!rightCharacter.test(character)) {
          break;
        }

        end += character.length;
      }

      // A single terminal period is prose punctuation, not a domain suffix.
      if (
        text[end - 1] === "." &&
        text[end - 2] !== "." &&
        (end === text.length || /\s/u.test(text[end] ?? ""))
      ) {
        end--;
      }

      const local = text.slice(start, at);
      const domain = text.slice(at + 1, end);

      if (
        local.length > 64 ||
        end - start > 254 ||
        text[start - 1] === '"' ||
        !localGrammar.test(local) ||
        !domainGrammar.test(domain)
      ) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "email",
        entityType: "email",
        reasons: ["email.ascii_dot_atom", "email.dns_domain"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const emailDetector = new EmailDetector();
