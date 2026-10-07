import type { AuditEvent, AuditSink } from "sensored";

export interface CounterLike {
  add(value: number, attributes?: Record<string, string>): void;
}

export interface MeterLike {
  createCounter(name: string, opts?: { description?: string }): CounterLike;
}

export interface MeterProviderLike {
  getMeter(name: string, version?: string): MeterLike;
  forceFlush?(): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface OtelMetricsSinkOptions {
  readonly provider: MeterProviderLike;
  readonly meterName?: string;
  readonly meterVersion?: string;
}

export class OtelMetricsSink implements AuditSink {
  private readonly counter: CounterLike;
  private readonly provider: MeterProviderLike;

  constructor(options: OtelMetricsSinkOptions) {
    this.provider = options.provider;

    const meter = options.provider.getMeter(
      options.meterName ?? "sensored.audit",
      options.meterVersion ?? "1.0.0",
    );

    this.counter = meter.createCounter("sensored.detections", {
      description: "Count of PII detections by entity type and action",
    });
  }

  write(event: AuditEvent): void {
    this.counter.add(1, {
      entityType: event.entityType,
      action: event.action,
      ruleId: event.ruleId,
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
}
