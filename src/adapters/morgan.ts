import { createRedactor } from "../index";
import type { RedactorConfig } from "../types";

export interface MorganStream {
  write: (str: string) => void;
}

export function morganRedact(
  config: RedactorConfig,
  stream: MorganStream,
): MorganStream {
  const redactor = createRedactor(config);

  return {
    write(str: string): void {
      stream.write(redactor.redact(str));
    },
  };
}
