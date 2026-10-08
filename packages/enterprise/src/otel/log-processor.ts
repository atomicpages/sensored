import type { Context } from "@opentelemetry/api";
import type {
  LogRecordProcessor,
  ReadWriteLogRecord,
} from "@opentelemetry/sdk-logs";

import { createRedactor, type Redactor, redactValue } from "sensored";

import {
  cloneWithOverrides,
  type RedactionConfig,
  redactAttributes,
} from "./redaction-utils";

export class SensoredLogRecordProcessor implements LogRecordProcessor {
  private readonly delegate: LogRecordProcessor;
  private readonly config: RedactionConfig;
  private readonly redactor: Redactor;

  constructor(delegate: LogRecordProcessor, config: RedactionConfig) {
    this.delegate = delegate;
    this.config = config;
    this.redactor = createRedactor(config.redactorConfig);
  }

  onEmit(logRecord: ReadWriteLogRecord, context?: Context): void {
    let redactedBody = logRecord.body;

    if (typeof logRecord.body === "string") {
      const result = this.redactor.redact(logRecord.body);
      redactedBody = typeof result === "string" ? result : result.text;
    } else if (logRecord.body !== undefined && logRecord.body !== null) {
      redactedBody = redactValue(logRecord.body, this.redactor);
    }

    const redactedAttributes = redactAttributes(
      logRecord.attributes as Record<string, unknown>,
      this.config,
      this.redactor,
    );

    const redactedLogRecord = cloneWithOverrides(logRecord, {
      body: redactedBody,
      attributes: redactedAttributes,
    });

    this.delegate.onEmit(redactedLogRecord, context);
  }

  forceFlush(): Promise<void> {
    return this.delegate.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.delegate.shutdown();
  }
}
