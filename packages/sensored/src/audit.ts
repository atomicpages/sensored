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
 *
 * The `replacement` field shows the placeholder or safe indicator that
 * replaced the PII — never the original value. For `mask` and
 * `format-preserve` actions, only a safe label (`[MASKED]`,
 * `[FORMAT_PRESERVED]`) is emitted because those renderings preserve
 * partial PII. In detect-only mode, `[DETECT_ONLY]` is used.
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
  /** When true, replacement is emitted as `[DETECT_ONLY]` instead of the
   *  original PII (which is what the engine produces in detect-only mode). */
  readonly detectOnly?: boolean;
}

/**
 * Sanitize the replacement for audit safety.
 *
 * `mask` and `format-preserve` renderings preserve partial PII characters,
 * and detect-only mode forwards the original PII. Replace those with safe
 * labels so the audit event never leaks sensitive data.
 */
function safeReplacement(
  action: AuditAction,
  replacement: string,
  detectOnly: boolean,
): string {
  if (detectOnly) {
    return "[DETECT_ONLY]";
  }

  if (action === "mask") {
    return "[MASKED]";
  }

  if (action === "format-preserve") {
    return "[FORMAT_PRESERVED]";
  }

  return replacement;
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
  const detectOnly = options?.detectOnly ?? false;

  for (const group of groups) {
    const action = group.action ?? "redact";
    const replacement = safeReplacement(action, group.replacement, detectOnly);

    for (const match of group.matches) {
      try {
        const ret: unknown = sink.write({
          ruleId: match.ruleId,
          entityType: match.entityType,
          action,
          reasons: match.reasons,
          start: match.start + offset,
          end: match.end + offset,
          replacement,
          timestamp,
        });

        if (
          ret !== null &&
          typeof ret === "object" &&
          typeof (ret as { then: unknown }).then === "function"
        ) {
          (ret as Promise<unknown>).catch(() => undefined);
        }
      } catch {
        // Audit logging must never break the redaction pipeline.
      }
    }
  }
}
