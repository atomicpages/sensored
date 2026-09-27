import type { AppliedMatch } from "../engine";
import { fnv1a32 } from "../hash";
import { DEFAULT_TOKEN_GENERATORS } from "../token-generators";

/**
 * Render a token-replace replacement: deterministic fake data based on a hash
 * of the original value. If a custom token mapping exists for the entity type,
 * use that instead of the default generator.
 */
export function renderTokenReplace(
  text: string,
  matches: AppliedMatch[],
  start: number,
  end: number,
): string {
  const originalText = text.slice(start, end);
  const entityType = matches[0]?.rule.detector.entityType ?? "REDACTED";

  for (const { rule } of matches) {
    if (rule.setting.action === "token-replace" && rule.setting.tokens) {
      const custom = rule.setting.tokens[entityType];

      if (custom !== undefined) {
        return custom;
      }
    }
  }

  const generator = DEFAULT_TOKEN_GENERATORS[entityType];

  if (generator !== undefined) {
    return generator(originalText);
  }

  return `[REDACTED_${fnv1a32(originalText).toString(16).padStart(8, "0").toUpperCase()}]`;
}
