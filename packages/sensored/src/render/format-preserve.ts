import { segment } from "../grapheme";

const letter = /\p{L}/u;
const digit = /\p{Nd}/u;

/**
 * Render a format-preserving replacement, one symbol per grapheme cluster:
 * clusters with a letter become `*`, clusters with a decimal digit become `X`,
 * and everything else (separators, punctuation, emoji) is kept.
 *
 * Example: `123-45-6789` → `XXX-XX-XXXX`, `josé@example.com` → `****@*******.***`
 */
export function renderFormatPreserve(
  text: string,
  start: number,
  end: number,
): string {
  const result: string[] = [];

  for (const { segment: cluster } of segment(text.slice(start, end))) {
    if (letter.test(cluster)) {
      result.push("*");
    } else if (digit.test(cluster)) {
      result.push("X");
    } else {
      result.push(cluster);
    }
  }

  return result.join("");
}
