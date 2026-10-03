import {
  collectMatches,
  createRestorationContext,
  renderMatches,
} from "../engine";
import { createRedactor } from "../index";
import { redactValue } from "../traverse";
import type { ActiveRule, RedactorConfig, RestorationMap } from "../types";

export interface SharedRedactor {
  redact(text: string): string;
  readonly map: RestorationMap;
}

export function createSharedRedactor(
  rules: readonly ActiveRule[],
  allowlist: Set<string>,
): SharedRedactor {
  const restoration = createRestorationContext();

  return {
    redact(text: string): string {
      const matches = collectMatches(text, rules, allowlist);
      const { segments } = renderMatches(
        text,
        matches,
        text.length,
        false,
        0,
        restoration,
      );
      return segments.map((s) => s.text).join("");
    },
    get map(): RestorationMap {
      return Object.freeze(Object.fromEntries(restoration.map.entries()));
    },
  };
}

export function createLogRedactor(
  config: RedactorConfig,
): (obj: Record<string, unknown>) => Record<string, unknown> {
  const redactor = createRedactor(config);

  return (obj: Record<string, unknown>): Record<string, unknown> => {
    return redactValue(obj, redactor) as Record<string, unknown>;
  };
}
