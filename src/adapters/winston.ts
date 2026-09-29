import type { RedactorConfig } from "../types";
import { createLogRedactor } from "./shared";

export function winstonRedact(
  config: RedactorConfig,
): (info: Record<string, unknown>) => Record<string, unknown> {
  return createLogRedactor(config);
}
