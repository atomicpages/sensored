export type ErrorCode =
  | "INVALID_CONFIG"
  | "UNKNOWN_RULE"
  | "EMPTY_POLICY"
  | "INPUT_LIMIT"
  | "DETECTOR_CONTRACT"
  | "POLICY_CONFLICT"
  | "STREAM_UNSUPPORTED"
  | "BUFFER_LIMIT"
  | "SOURCE_FAILURE"
  | "CANCELLED";

const details: Record<ErrorCode, string> = {
  INVALID_CONFIG: "Configuration or input has an invalid shape.",
  UNKNOWN_RULE: "Configuration contains an unknown rule.",
  EMPTY_POLICY: "At least one rule must be enabled.",
  DETECTOR_CONTRACT: "A detector violated its declared contract.",
  INPUT_LIMIT: "Input exceeds the complete-string limit.",
  POLICY_CONFLICT:
    "Presets contain conflicting rule settings that require explicit override.",
  STREAM_UNSUPPORTED: "One or more active rules do not support streaming.",
  BUFFER_LIMIT: "Streaming buffer exceeded the configured limit.",
  SOURCE_FAILURE: "The stream source produced an error.",
  CANCELLED: "The operation was cancelled.",
};

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  INVALID_CONFIG: 400,
  UNKNOWN_RULE: 400,
  EMPTY_POLICY: 400,
  INPUT_LIMIT: 413,
  DETECTOR_CONTRACT: 500,
  POLICY_CONFLICT: 409,
  STREAM_UNSUPPORTED: 400,
  BUFFER_LIMIT: 413,
  SOURCE_FAILURE: 424,
  CANCELLED: 499,
};

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly code: ErrorCode;
  readonly path?: string;
  readonly [key: string]: unknown;
}

/** Messages and paths contain no caller-supplied values. */
export class SensoredError extends Error {
  readonly code: ErrorCode;
  readonly path?: string;
  readonly info?: Readonly<Record<string, unknown>>;

  constructor(
    code: ErrorCode,
    path?: string,
    info?: Readonly<Record<string, unknown>>,
  ) {
    super(details[code]);
    this.name = "SensoredError";
    this.code = code;
    this.path = path;
    this.info = info;
  }

  /**
   * Serialize to an RFC 9457 Problem Details object.
   *
   * HTTP-independent: the application owns status mapping.
   * Supplied mappings must respect the only-500-in-5xx rule;
   * any 5xx status other than 500 throws.
   */
  toProblemDetails(
    statusMap?: Partial<Record<ErrorCode, number>>,
  ): ProblemDetails {
    const status = statusMap?.[this.code] ?? DEFAULT_STATUS[this.code];

    if (status >= 500 && status !== 500) {
      throw new Error(
        `Invalid status ${status}: only permitted 5xx status is 500`,
      );
    }

    return Object.freeze({
      type: `urn:sensored:error:${this.code.toLowerCase()}`,
      title: this.code,
      status,
      detail: details[this.code],
      code: this.code,
      ...(this.path !== undefined && { path: this.path }),
      ...(this.info !== undefined && { info: this.info }),
    });
  }
}
