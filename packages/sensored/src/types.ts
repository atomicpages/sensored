import type { AuditAction, AuditSink } from "./audit";
import type { Detector } from "./detectors/base";
import type { SemanticQuestion } from "./semantic/types";

export type { AuditAction, AuditSink, Detector };

/** All offsets refer to the original string, in UTF-16 code units. */
export interface Detection {
  readonly start: number;
  readonly end: number;
  readonly ruleId: string;
  readonly entityType: string;
  readonly reasons: readonly string[];
}

export interface InspectedMatch extends Detection {
  readonly value: string;
}

export interface InspectionGroup {
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
  readonly action?: AuditAction;
  readonly matches: readonly InspectedMatch[];
}

export interface Inspection {
  readonly text: string;
  readonly groups: readonly InspectionGroup[];
}

export interface RedactRule {
  readonly action: "redact";
  readonly replacement?: string;
  readonly priority?: number;
}

export type RestorationMap = Readonly<Record<string, string>>;

export interface RedactResult {
  readonly text: string;
  readonly map: RestorationMap;
}

export interface SemanticConfig {
  readonly provider: "jev";
  readonly apiKey: string;
  readonly model?: string;
  readonly thresholds?: Readonly<Record<string, number>>;
  readonly contextWindow?: number;
}

export interface DetectorOptions {
  readonly http_auth_header?: {
    readonly customHeaders?: readonly (string | RegExp)[];
  };
}

export interface RedactorConfig {
  readonly presets?: readonly string[];
  readonly customPresets?: Readonly<
    Record<string, Readonly<Record<string, RuleSetting | "off">>>
  >;
  readonly limits?: { readonly maxInputLength?: number };
  readonly rules: Readonly<Record<string, RuleSetting | "off">>;
  readonly detectors?: readonly DetectorDefinition[];
  readonly restore?: boolean;
  readonly allowlist?: readonly string[];
  readonly semantic?: SemanticConfig;
  readonly detectOnly?: boolean;
  readonly detectorOptions?: DetectorOptions;
  readonly auditSink?: AuditSink;
}

export interface DetectorDefinition {
  readonly id: string;
  readonly entityType: string;
  readonly replacement: string;
  readonly pattern: RegExp;
  readonly context?: { readonly before: number; readonly after: number };

  readonly stream?: {
    readonly maxMatchLength: number;
    readonly leftContext: number;
    readonly rightContext: number;
    readonly boundaryLookaround: number;
  };

  readonly validate?: (candidate: {
    readonly value: string;
    readonly before: string;
    readonly after: string;
  }) => false | readonly string[];

  readonly contextHint?: {
    readonly labels?: readonly string[];
    readonly position?: "preceding" | "following" | "both";
    readonly instructions?: string;
  };

  readonly semanticConfirm?: (candidate: {
    readonly value: string;
    readonly before: string;
    readonly after: string;
  }) => SemanticQuestion | undefined;
}

export interface ContextHint {
  readonly required: boolean;
  readonly labels: readonly string[];
  readonly position: "preceding" | "following" | "both";
  readonly window: { readonly before: number; readonly after: number };
  readonly instructions?: string;
}

export interface DetectorDescription {
  readonly id: string;
  readonly entityType: string;
  readonly replacement: string;
  readonly stream: boolean;
  readonly contextHint?: ContextHint;
}

export interface FormatPreserveRule {
  readonly action: "format-preserve";
}

export interface TokenReplaceRule {
  readonly action: "token-replace";
  readonly tokens?: Readonly<Record<string, string>>;
}

export interface MaskRule {
  readonly action: "mask";
  readonly preserve?: { readonly first?: number; readonly last?: number };
}

export interface RemoveRule {
  readonly action: "remove";
}

export type RuleSetting =
  | RedactRule
  | FormatPreserveRule
  | TokenReplaceRule
  | MaskRule
  | RemoveRule;
export interface ActiveRule {
  readonly detector: Detector;
  readonly setting: RuleSetting;
}

export interface StreamOptions {
  readonly signal?: AbortSignal;
  readonly report?: boolean;
  readonly restore?: boolean;
  readonly auditSink?: AuditSink;
}

export type StreamEvent =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "detection"; readonly group: InspectionGroup }
  | { readonly type: "complete"; readonly map?: RestorationMap };
