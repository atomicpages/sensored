import type { AuditEvent, AuditSink } from "sensored";

export interface LoggerLike {
  emit(record: {
    readonly severityNumber: number;
    readonly severityText: string;
    readonly body: string;
    readonly attributes?: Record<string, string | number | boolean>;
  }): void;
}

export interface LoggerProviderLike {
  getLogger(name: string, version?: string): LoggerLike;
  forceFlush?(): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface OtelAuditSinkOptions {
  readonly provider: LoggerProviderLike;
  readonly loggerName?: string;
  readonly loggerVersion?: string;
}

interface OtelApi {
  trace: {
    getActiveSpan():
      | {
          spanContext(): { traceId: string; spanId: string };
        }
      | undefined;
  };
}

export class OtelAuditSink implements AuditSink {
  private readonly logger: LoggerLike;
  private readonly provider: LoggerProviderLike;
  private otelApi: OtelApi | null = null;

  constructor(options: OtelAuditSinkOptions) {
    this.provider = options.provider;

    this.logger = options.provider.getLogger(
      options.loggerName ?? "sensored.audit",
      options.loggerVersion ?? "1.0.0",
    );

    this.tryLoadOtelApi();
  }

  write(event: AuditEvent): void {
    const attributes: Record<string, string | number | boolean> = {
      ruleId: event.ruleId,
      entityType: event.entityType,
      action: event.action,
      reasons: JSON.stringify(event.reasons),
      start: event.start,
      end: event.end,
      replacement: event.replacement,
      timestamp: event.timestamp,
    };

    if (this.otelApi) {
      const span = this.otelApi.trace.getActiveSpan();

      if (span) {
        const ctx = span.spanContext();

        attributes.traceId = ctx.traceId;
        attributes.spanId = ctx.spanId;
      }
    }

    this.logger.emit({
      severityNumber: 9,
      severityText: "INFO",
      body: "sensored.audit",
      attributes,
    });
  }

  flush(): Promise<void> {
    if (this.provider.forceFlush) {
      return this.provider.forceFlush();
    }

    return Promise.resolve();
  }

  close(): Promise<void> {
    if (this.provider.shutdown) {
      return this.provider.shutdown();
    }

    return Promise.resolve();
  }

  private tryLoadOtelApi(): void {
    const moduleName = "@opentelemetry/api";

    try {
      this.otelApi = require(moduleName) as OtelApi;
    } catch {
      // no-op
    }
  }
}
