import type { InspectionGroup, RuleSetting } from "./types";

/**
 * The action that won precedence for a detection group.
 * Derived from `RuleSetting["action"]` — no type duplication.
 */
export type AuditAction = RuleSetting["action"];

/**
 * A single audit event for one detection within a redaction group.
 *
 * IMPORTANT: This event must NEVER contain the original PII value.
 * Only metadata (ruleId, entityType, action, reasons, offsets, replacement)
 * is included so audit trails remain safe to ship to any backend.
 */
export interface AuditEvent {
  readonly ruleId: string;
  readonly entityType: string;
  readonly action: AuditAction;
  readonly reasons: readonly string[];
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
  readonly timestamp: number;
}

/**
 * A sink that receives audit events from the redaction pipeline.
 *
 * `write()` is synchronous fire-and-forget. Implementations that batch
 * (e.g. OTEL SDKs) should buffer internally and flush on `flush()` or
 * `close()`. Errors in `write()` MUST be swallowed by the pipeline —
 * audit logging must never break redaction.
 */
export interface AuditSink {
  write(event: AuditEvent): void;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

/**
 * Options for {@link emitAuditEvents}.
 */
export interface EmitAuditEventsOptions {
  /** Offset added to each match's start/end (for streaming absolute positions). */
  readonly offset?: number;
  /** Timestamp to use for all events. Defaults to `Date.now()`. */
  readonly timestamp?: number;
}

/**
 * Emit one audit event per detection across all groups.
 *
 * Not re-exported from the package barrel — internal use only.
 */
export function emitAuditEvents(
  groups: readonly InspectionGroup[],
  sink: AuditSink,
  options?: EmitAuditEventsOptions,
): void {
  const timestamp = options?.timestamp ?? Date.now();
  const offset = options?.offset ?? 0;

  for (const group of groups) {
    for (const match of group.matches) {
      try {
        sink.write({
          ruleId: match.ruleId,
          entityType: match.entityType,
          action: group.action ?? "redact",
          reasons: match.reasons,
          start: match.start + offset,
          end: match.end + offset,
          replacement: group.replacement,
          timestamp,
        });
      } catch {
        // Audit logging must never break the redaction pipeline.
      }
    }
  }
}
