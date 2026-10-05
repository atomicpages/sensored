import { createRedactor } from "../index";
import { redactValue } from "../traverse";
import type { RedactorConfig } from "../types";

const METHODS = [
  "log",
  "info",
  "warn",
  "error",
  "debug",
  "trace",
  "dir",
  "dirxml",
  "group",
  "groupCollapsed",
] as const;

export type ConsoleLike = {
  [K in (typeof METHODS)[number]]: (...args: unknown[]) => void;
};

export function wrapConsole(
  config: RedactorConfig,
  consoleObj: ConsoleLike = console as ConsoleLike,
): () => void {
  const redactor = createRedactor(config);

  const originals = new Map<
    (typeof METHODS)[number],
    (...args: unknown[]) => void
  >();

  for (const method of METHODS) {
    const original = consoleObj[method];
    originals.set(method, original);

    consoleObj[method] = (...args: unknown[]): void => {
      const redacted = args.map((arg) => {
        if (typeof arg === "string") {
          return redactor.redact(arg);
        }

        return redactValue(arg, redactor);
      });

      original.apply(consoleObj, redacted);
    };
  }

  return () => {
    for (const [method, original] of originals) {
      consoleObj[method] = original;
    }
  };
}
