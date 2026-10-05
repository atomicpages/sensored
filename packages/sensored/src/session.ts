import { createSharedRedactor } from "./adapters/shared";
import { SensoredError } from "./errors";
import { resolvePolicy } from "./policy";
import { restore } from "./restore";
import { StreamRestorer } from "./stream-restore";
import { SESSION_BRAND } from "./symbols";
import { redactValue } from "./traverse";
import type { RedactorConfig, RestorationMap } from "./types";

export { SESSION_BRAND } from "./symbols";

export interface Session {
  readonly redact: (text: string) => string;
  readonly redactMessages: <
    T extends readonly { role: string; content: unknown }[],
  >(
    messages: T,
  ) => T;
  readonly restore: (text: string) => string;
  readonly stream: () => StreamRestorer;
  readonly reset: () => void;
  readonly map: RestorationMap;
  readonly [SESSION_BRAND]: true;
}

export function createSession(
  config: RedactorConfig,
  existingMap?: RestorationMap,
): Session {
  if (config.detectOnly) {
    throw new SensoredError("INVALID_CONFIG", "detectOnly");
  }

  const { rules, allowlist } = resolvePolicy(config);

  let shared = createSharedRedactor(rules, allowlist, {
    dedup: true,
    initialMap: existingMap,
  });

  return {
    redact(text: string): string {
      return shared.redact(text);
    },

    redactMessages<T extends readonly { role: string; content: unknown }[]>(
      messages: T,
    ): T {
      return redactValue(messages, {
        redact: (text: string) => shared.redact(text),
      });
    },

    restore(text: string): string {
      return restore(text, shared.map);
    },

    stream(): StreamRestorer {
      return new StreamRestorer(shared.map);
    },

    reset(): void {
      shared = createSharedRedactor(rules, allowlist, {
        dedup: true,
        initialMap: existingMap,
      });
    },

    get map(): RestorationMap {
      return shared.map;
    },

    [SESSION_BRAND]: true as const,
  };
}
