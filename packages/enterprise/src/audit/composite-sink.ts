import type { AuditEvent, AuditSink } from "sensored";

export interface CompositeAuditSinkOptions {
  readonly sinks: readonly AuditSink[];
}

export class CompositeAuditSink implements AuditSink {
  private readonly sinks: readonly AuditSink[];

  constructor(options: CompositeAuditSinkOptions) {
    this.sinks = options.sinks;
  }

  write(event: AuditEvent): void {
    for (const sink of this.sinks) {
      try {
        sink.write(event);
      } catch {
        // no-op
      }
    }
  }

  async flush(): Promise<void> {
    await Promise.all(
      this.sinks.map((sink) =>
        Promise.resolve(sink.flush?.()).catch(() => undefined),
      ),
    );

    return undefined;
  }

  async close(): Promise<void> {
    await Promise.all(
      this.sinks.map((sink) =>
        Promise.resolve(sink.close?.()).catch(() => undefined),
      ),
    );

    return undefined;
  }
}
