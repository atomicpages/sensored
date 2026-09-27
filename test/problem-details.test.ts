import { describe, expect, test } from "bun:test";
import { type ErrorCode, type ProblemDetails, SensoredError } from "../src";

describe("toProblemDetails — default status mapping", () => {
  const cases: [ErrorCode, number][] = [
    ["INVALID_CONFIG", 400],
    ["UNKNOWN_RULE", 400],
    ["EMPTY_POLICY", 400],
    ["INPUT_LIMIT", 413],
    ["DETECTOR_CONTRACT", 500],
    ["POLICY_CONFLICT", 409],
    ["STREAM_UNSUPPORTED", 400],
    ["BUFFER_LIMIT", 413],
    ["SOURCE_FAILURE", 424],
    ["CANCELLED", 499],
  ];

  test.each(cases)("%s → %d", (code, status) => {
    const error = new SensoredError(code);
    const pd = error.toProblemDetails();

    expect(pd.code).toBe(code);
    expect(pd.status).toBe(status);
    expect(pd.type).toBe(`urn:sensored:error:${code.toLowerCase()}`);
    expect(pd.title).toBe(code);
    expect(typeof pd.detail).toBe("string");
    expect(pd.detail.length).toBeGreaterThan(0);
  });
});

describe("toProblemDetails — path inclusion", () => {
  test("path is included when provided", () => {
    const error = new SensoredError("UNKNOWN_RULE", "rules");
    const pd = error.toProblemDetails();

    expect(pd.path).toBe("rules");
  });

  test("path is omitted when not provided", () => {
    const error = new SensoredError("INPUT_LIMIT");
    const pd = error.toProblemDetails();

    expect(pd).not.toHaveProperty("path");
  });
});

describe("toProblemDetails — immutability", () => {
  test("returned object is frozen", () => {
    const error = new SensoredError("INVALID_CONFIG");
    const pd = error.toProblemDetails();

    expect(Object.isFrozen(pd)).toBe(true);
  });
});

describe("toProblemDetails — custom status mapping", () => {
  test("override status for a specific code", () => {
    const error = new SensoredError("CANCELLED");
    const pd = error.toProblemDetails({ CANCELLED: 400 });

    expect(pd.status).toBe(400);
  });

  test("override only affects specified code", () => {
    const error = new SensoredError("INPUT_LIMIT");
    const pd = error.toProblemDetails({ CANCELLED: 400 });

    expect(pd.status).toBe(413);
  });

  test("override with 500 is allowed", () => {
    const error = new SensoredError("SOURCE_FAILURE");
    const pd = error.toProblemDetails({ SOURCE_FAILURE: 500 });

    expect(pd.status).toBe(500);
  });

  test("override with 501 throws", () => {
    const error = new SensoredError("DETECTOR_CONTRACT");

    expect(() => error.toProblemDetails({ DETECTOR_CONTRACT: 501 })).toThrow();
  });

  test("override with 502 throws", () => {
    const error = new SensoredError("SOURCE_FAILURE");

    expect(() => error.toProblemDetails({ SOURCE_FAILURE: 502 })).toThrow();
  });

  test("override with 503 throws", () => {
    const error = new SensoredError("DETECTOR_CONTRACT");

    expect(() => error.toProblemDetails({ DETECTOR_CONTRACT: 503 })).toThrow();
  });

  test("override with 4xx is allowed", () => {
    const error = new SensoredError("CANCELLED");
    const pd = error.toProblemDetails({ CANCELLED: 408 });

    expect(pd.status).toBe(408);
  });
});

describe("toProblemDetails — no sensitive data", () => {
  test("detail does not contain input text", () => {
    const error = new SensoredError("INPUT_LIMIT");
    const pd = error.toProblemDetails();

    expect(pd.detail).not.toContain("user");
    expect(pd.detail).not.toContain("input");
  });
});
