import { createRedactor } from "../index";
import { redactValue } from "../traverse";
import type { RedactorConfig } from "../types";

export interface BunyanRawStream {
  write(rec: Record<string, unknown>): boolean;
}

export function bunyanRedact(
  config: RedactorConfig,
  stream: { write: (str: string) => void },
): BunyanRawStream {
  const redactor = createRedactor(config);

  return {
    write(rec: Record<string, unknown>): boolean {
      const redacted = redactValue(rec, redactor) as Record<string, unknown>;
      stream.write(`${JSON.stringify(redacted)}\n`);
      return true;
    },
  };
}
