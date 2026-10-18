import { isErrorCode, SensoredError } from "../errors";
import type { DetectorDescription, RestorationMap } from "../types";
import { deepFreeze, isRecord } from "../utils";
import { getBinding } from "./binding";

/** An engine `Error` (`code`, `path?`, `info?`) as a `SensoredError`. */
function rewrap(error: unknown): unknown {
  if (error instanceof SensoredError || !(error instanceof Error)) {
    return error;
  }

  if (!("code" in error) || !isErrorCode(error.code)) {
    return error;
  }

  const path =
    "path" in error && typeof error.path === "string" ? error.path : undefined;
  const info = "info" in error && isRecord(error.info) ? error.info : undefined;

  return new SensoredError(error.code, path, info);
}

/**
 * Runs a binding call, rethrowing engine errors as `SensoredError`. What JS
 * detectors throw inside the call passes through unchanged.
 */
export function engineCall<T>(call: () => T): T {
  try {
    return call();
  } catch (error) {
    throw rewrap(error);
  }
}

export function restore(text: string, map: RestorationMap): string {
  return engineCall(() => getBinding().restore(text, map));
}

export function listDetectors(): readonly DetectorDescription[] {
  return deepFreeze(
    JSON.parse(engineCall(() => getBinding().listDetectorsJson())),
  );
}
