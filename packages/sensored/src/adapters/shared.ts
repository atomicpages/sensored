import { createRedactor } from "../index";
import { PLACEHOLDER_TEST } from "../placeholders";
import type { Session } from "../session";
import { SESSION_BRAND } from "../symbols";
import { redactValue } from "../traverse";
import type { RedactorConfig, RestorationMap } from "../types";

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

/** Session numbering: placeholder to original, per-base counters, dedup. */
interface Numbering {
  readonly map: Map<string, string>;
  readonly counters: Map<string, number>;
  readonly reverseMap?: Map<string, string>;
}

function createNumbering(
  dedup: boolean,
  initialMap: RestorationMap | undefined,
): Numbering {
  const numbering: Numbering = {
    map: new Map(),
    counters: new Map(),
    reverseMap: dedup ? new Map() : undefined,
  };

  for (const [placeholder, original] of Object.entries(initialMap ?? {})) {
    if (!PLACEHOLDER_TEST.test(placeholder)) {
      continue;
    }

    numbering.map.set(placeholder, original);

    const lastUnderscore = placeholder.lastIndexOf("_");
    if (lastUnderscore > 0) {
      const base = placeholder.slice(1, lastUnderscore);
      const num = Number.parseInt(
        placeholder.slice(lastUnderscore + 1, -1),
        10,
      );
      if (Number.isInteger(num)) {
        const current = numbering.counters.get(base) ?? 0;
        numbering.counters.set(base, Math.max(current, num));
      }
    }

    numbering.reverseMap?.set(original, placeholder);
  }

  return numbering;
}

/**
 * The session placeholder for `original`. `replacement` is the engine's
 * per-call placeholder (`[EMAIL_1]`); only its base is kept, and the number
 * continues the session's counter.
 */
function placeholderFor(
  numbering: Numbering,
  replacement: string,
  original: string,
): string {
  const existing = numbering.reverseMap?.get(original);

  if (existing) {
    return existing;
  }

  const base = replacement.slice(1, replacement.lastIndexOf("_"));
  const counter = (numbering.counters.get(base) ?? 0) + 1;
  const placeholder = `[${base}_${counter}]`;

  numbering.counters.set(base, counter);
  numbering.map.set(placeholder, original);
  numbering.reverseMap?.set(original, placeholder);

  return placeholder;
}

/** Longer than any JS string, and within the Wasm core's 32-bit lengths. */
const UNLIMITED_INPUT = 2 ** 31 - 1;

/**
 * A redactor whose placeholders number across calls. The engine renders each
 * call with restoration on; its groups are renumbered against the session.
 * `detectOnly` configs keep their flag (adapters skip redaction for them).
 */
export function createSharedRedactor(
  config: RedactorConfig,
  options?: {
    dedup?: boolean;
    initialMap?: RestorationMap;
  },
): SharedRedactor {
  const redactor = createRedactor({
    ...config,
    ...(config.detectOnly ? {} : { restore: true }),
    // Sessions never enforced the input limit; keep that unless asked.
    limits: { maxInputLength: UNLIMITED_INPUT, ...config.limits },
  });
  const dedup = options?.dedup ?? false;

  let numbering = createNumbering(dedup, options?.initialMap);

  return {
    redact(text: string): string {
      const { groups } = redactor.inspect(text);
      let output = "";
      let cursor = 0;

      for (const { start, end, replacement } of groups) {
        output += text.slice(cursor, start);
        output += placeholderFor(
          numbering,
          replacement,
          text.slice(start, end),
        );
        cursor = end;
      }

      return output + text.slice(cursor);
    },
    get map(): RestorationMap {
      return Object.fromEntries(numbering.map.entries());
    },
    reset(): void {
      numbering = createNumbering(dedup, undefined);
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
