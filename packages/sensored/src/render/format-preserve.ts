/**
 * Render a format-preserving replacement: digits become `X`, letters become
 * `*`, all other characters (separators, punctuation, structure) are kept.
 *
 * Example: `123-45-6789` → `XXX-XX-XXXX`, `john@example.com` → `****@*******.***`
 */
export function renderFormatPreserve(
  text: string,
  start: number,
  end: number,
): string {
  const result: string[] = [];

  for (const char of text.slice(start, end)) {
    if (char >= "0" && char <= "9") {
      result.push("X");
    } else if ((char >= "a" && char <= "z") || (char >= "A" && char <= "Z")) {
      result.push("*");
    } else {
      result.push(char);
    }
  }

  return result.join("");
}
