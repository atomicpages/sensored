import { createLogRedactor } from "../adapters/shared";
import type { RedactorConfig } from "../types";

export function pinoRedact(config: RedactorConfig): {
  formatters: {
    log: (obj: Record<string, unknown>) => Record<string, unknown>;
  };
} {
  const redact = createLogRedactor(config);

  return {
    formatters: {
      log: redact,
    },
  };
}
