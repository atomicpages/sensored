import { createLogRedactor } from "../adapters/shared";
import type { RedactorConfig } from "../types";

export function winstonRedact(
  config: RedactorConfig,
): (info: Record<string, unknown>) => Record<string, unknown> {
  return createLogRedactor(config);
}
