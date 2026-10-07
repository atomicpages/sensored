import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";

import { createRedactor, type Redactor } from "sensored";

import {
  cloneWithOverrides,
  type RedactionConfig,
  redactStringAttributes,
} from "./redaction-utils";

export class SensoredSpanProcessor implements SpanProcessor {
  private readonly delegate: SpanProcessor;
  private readonly config: RedactionConfig;
  private readonly redactor: Redactor;

  constructor(delegate: SpanProcessor, config: RedactionConfig) {
    this.delegate = delegate;
    this.config = config;
    this.redactor = createRedactor(config.redactorConfig);
  }

  onStart(span: Span, parentContext: Context): void {
    this.delegate.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    const redactedName = this.redactor.redact(span.name);
    const redactedNameStr =
      typeof redactedName === "string" ? redactedName : redactedName.text;

    const redactedAttributes = redactStringAttributes(
      span.attributes as Record<string, unknown>,
      this.config,
      this.redactor,
    );

    const redactedSpan = cloneWithOverrides(span, {
      name: redactedNameStr,
      attributes: redactedAttributes,
    });

    this.delegate.onEnd(redactedSpan);
  }

  forceFlush(): Promise<void> {
    return this.delegate.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.delegate.shutdown();
  }
}
