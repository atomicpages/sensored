/**
 * The engine contract every build satisfies: the napi addon
 * (`crates/sensored-napi/index.d.ts`) and the Wasm module
 * (`crates/sensored-wasm`). Offsets are UTF-16 code units. Methods throw an
 * `Error` carrying the core's `code`, `path` and `info`; `api.ts` rewraps it
 * as `SensoredError`.
 *
 * Each entry point (`index.ts`, the Wasm entries) loads one build and calls
 * `setBinding` in its own body before any redactor is created, so the public
 * API stays engine-agnostic and synchronous.
 */
import type { RestorationMap } from "../types";

export interface NativeDetection {
  start: number;
  end: number;
  ruleId: string;
  entityType: string;
  reasons: string[];
}

export interface NativeInspectedMatch extends NativeDetection {
  value: string;
}

export interface NativeInspectionGroup {
  start: number;
  end: number;
  replacement: string;
  matches: NativeInspectedMatch[];
}

/** `map` is set when restoration is enabled. */
export interface NativeInspection {
  text: string;
  groups: NativeInspectionGroup[];
  map?: Record<string, string>;
}

export interface NativeRedactResult {
  text: string;
  map?: Record<string, string>;
}

export type NativeStreamEvent =
  | { type: "text"; text: string }
  | { type: "detection"; group: NativeInspectionGroup }
  | { type: "complete"; map?: Record<string, string> };

/** Detections in `buffer`, for caller (JS) detectors on a stream. */
export type NativeDetect = (buffer: string) => NativeDetection[];

export interface NativeStream {
  push(chunk: string): NativeStreamEvent[];
  pushWith(chunk: string, detect: NativeDetect): NativeStreamEvent[];
  finish(): NativeStreamEvent[];
  finishWith(detect: NativeDetect): NativeStreamEvent[];
}

export interface NativeRedactor {
  redact(text: string): string;
  redactWithMap(text: string): NativeRedactResult;
  inspect(text: string): NativeInspection;
  /** The effective policy (rule id to setting). */
  policyJson(): string;
  /** `DetectorDescription[]` for the enabled rules, in policy order. */
  describeJson(): string;
  stream(report: boolean, restore?: boolean | null): NativeStream;
  /** Raw core detections, before allowlist and placeholder filtering. */
  collect(text: string): NativeDetection[];
  /** What `render` keeps of `detections` (core plus JS). */
  filter(text: string, detections: NativeDetection[]): NativeDetection[];
  render(
    text: string,
    detections: NativeDetection[],
    report: boolean,
  ): NativeInspection;
}

export interface NativeBinding {
  readonly Redactor: { create(configJson: string): NativeRedactor };
  restore(text: string, map: RestorationMap): string;
  /** `DetectorDescription[]` for every built-in, in `listDetectors()` order. */
  listDetectorsJson(): string;
}

let current: NativeBinding | undefined;

export function setBinding(binding: NativeBinding): void {
  current = binding;
}

export function getBinding(): NativeBinding {
  if (current === undefined) {
    throw new Error(
      "sensored: no engine loaded; import sensored through its package entry.",
    );
  }

  return current;
}
