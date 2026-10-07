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
  redactAttributes,
} from "./redaction-utils";

interface SpanEvent {
  readonly name?: string;
  readonly attributes?: Record<string, unknown>;
}

interface SpanStatus {
  readonly message?: string;
}

interface SpanLink {
  readonly attributes?: Record<string, unknown>;
}

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

    const redactedAttributes = redactAttributes(
      span.attributes as Record<string, unknown>,
      this.config,
      this.redactor,
    );

    const overrides: Record<string, unknown> = {
      name: redactedNameStr,
      attributes: redactedAttributes,
    };

    const events = span.events as readonly SpanEvent[] | undefined;

    if (events !== undefined && events.length > 0) {
      overrides.events = events.map((event) => {
        const redactedEventName =
          typeof event.name === "string"
            ? this.redactor.redact(event.name)
            : event.name;

        const eventNameStr =
          typeof redactedEventName === "string"
            ? redactedEventName
            : (redactedEventName?.text ?? event.name);

        const redactedEventAttributes =
          event.attributes !== undefined
            ? redactAttributes(
                event.attributes as Record<string, unknown>,
                this.config,
                this.redactor,
              )
            : event.attributes;

        return {
          ...event,
          name: eventNameStr,
          attributes: redactedEventAttributes,
        };
      });
    }

    const status = span.status as SpanStatus | undefined;

    if (status !== undefined && typeof status.message === "string") {
      const redactedMessage = this.redactor.redact(status.message);
      const messageStr =
        typeof redactedMessage === "string"
          ? redactedMessage
          : redactedMessage.text;

      overrides.status = { ...status, message: messageStr };
    }

    const links = span.links as readonly SpanLink[] | undefined;

    if (links !== undefined && links.length > 0) {
      overrides.links = links.map((link) => {
        const redactedLinkAttributes =
          link.attributes !== undefined
            ? redactAttributes(
                link.attributes as Record<string, unknown>,
                this.config,
                this.redactor,
              )
            : link.attributes;

        return { ...link, attributes: redactedLinkAttributes };
      });
    }

    const redactedSpan = cloneWithOverrides(span, overrides);

    this.delegate.onEnd(redactedSpan);
  }

  forceFlush(): Promise<void> {
    return this.delegate.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.delegate.shutdown();
  }
}
