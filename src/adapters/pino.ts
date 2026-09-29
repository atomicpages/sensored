import type { RedactorConfig } from "../types";
import { createLogRedactor } from "./shared";

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
