import type { RestorationContext } from "../engine";
import {
  collectMatches,
  createRestorationContext,
  renderMatches,
} from "../engine";
import { createRedactor } from "../index";
import { PLACEHOLDER_TEST } from "../placeholders";
import type { Session } from "../session";
import { SESSION_BRAND } from "../symbols";
import { redactValue } from "../traverse";
import type { ActiveRule, RedactorConfig, RestorationMap } from "../types";

export { SESSION_BRAND } from "../symbols";

export interface RedactionAdapter {
  redact(text: string): string;
  readonly map: RestorationMap;
}

export function isSession(arg: unknown): arg is Session {
  return (
    typeof arg === "object" &&
    arg !== null &&
    // Cast required: symbol-keyed property access is not in TS's type narrowing
    (arg as Record<symbol, unknown>)[SESSION_BRAND] === true
  );
}

export interface SharedRedactor {
  redact(text: string): string;
  readonly map: RestorationMap;
  reset(): void;
}

function hydrateContext(
  ctx: RestorationContext,
  initialMap: RestorationMap,
): void {
  for (const [placeholder, original] of Object.entries(initialMap)) {
    if (!PLACEHOLDER_TEST.test(placeholder)) {
      continue;
    }

    ctx.map.set(placeholder, original);

    const lastUnderscore = placeholder.lastIndexOf("_");
    if (lastUnderscore > 0) {
      const base = placeholder.slice(1, lastUnderscore);
      const num = Number.parseInt(
        placeholder.slice(lastUnderscore + 1, -1),
        10,
      );
      if (Number.isInteger(num)) {
        const current = ctx.counters.get(base) ?? 0;
        ctx.counters.set(base, Math.max(current, num));
      }
    }

    if (ctx.reverseMap) {
      ctx.reverseMap.set(original, placeholder);
    }
  }
}

export function createSharedRedactor(
  rules: readonly ActiveRule[],
  allowlist: Set<string>,
  options?: {
    dedup?: boolean;
    initialMap?: RestorationMap;
  },
): SharedRedactor {
  let restoration = createRestorationContext(options?.dedup);

  if (options?.initialMap) {
    hydrateContext(restoration, options.initialMap);
  }

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
      return Object.fromEntries(restoration.map.entries());
    },
    reset(): void {
      restoration = createRestorationContext(options?.dedup);
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
