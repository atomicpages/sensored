import { createRedactor } from "../index";
import { redactValue } from "../traverse";
import type { RedactorConfig } from "../types";

export interface Log4jsAppenderConfig {
  appender: string;
  redact: RedactorConfig;
}

export function configure(
  config: Log4jsAppenderConfig,
  _layouts: unknown,
  findAppender: (name: string) => (event: { data: unknown[] }) => void,
): (loggingEvent: { data: unknown[] }) => void {
  const redactor = createRedactor(config.redact);

  return (loggingEvent: { data: unknown[] }): void => {
    const wrapped = findAppender(config.appender);

    const redactedData = loggingEvent.data.map((item) => {
      if (typeof item === "string") {
        return redactor.redact(item);
      }
      return redactValue(item, redactor);
    });

    const redactedEvent = { ...loggingEvent, data: redactedData };
    wrapped(redactedEvent);
  };
}
