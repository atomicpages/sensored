import { describe, expect, test } from "bun:test";

import {
  type Detection,
  listDetectorsJson,
  Redactor,
  restore,
  type StreamEvent,
} from "../index.js";

// The rule is a JS detector descriptor: the core finds nothing for it, and its
// matches come in through `render`, as the TS wrapper sends them.
const ticket = {
  id: "ticket_id",
  entityType: "ticket",
  replacement: "[TICKET]",
  stream: {
    maxMatchLength: 16,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  },
};

function config(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    rules: { ticket_id: { action: "redact" } },
    detectors: [ticket],
    ...overrides,
  });
}

function ticketAt(text: string, value: string): Detection {
  const start = text.indexOf(value);

  return {
    start,
    end: start + value.length,
    ruleId: "ticket_id",
    entityType: "ticket",
    reasons: ["ticket.pattern"],
  };
}

/** The shape documented in CONTEXT.md: a plain `Error` plus core fields. */
interface CoreError extends Error {
  code?: unknown;
  path?: unknown;
  info?: unknown;
}

function caught(fn: () => unknown): CoreError {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }

    throw error;
  }

  throw new Error("expected a throw");
}

function streamText(events: StreamEvent[]): string {
  return events.map((e) => (e.type === "text" ? e.text : "")).join("");
}

describe("Redactor.create", () => {
  test("exposes the resolved policy as JSON", () => {
    const redactor = Redactor.create(config());

    expect(JSON.parse(redactor.policyJson())).toEqual({
      ticket_id: { action: "redact" },
    });
  });

  test("throws INVALID_CONFIG for malformed JSON", () => {
    const error = caught(() => Redactor.create("{"));

    expect(error.code).toBe("INVALID_CONFIG");
    expect(error.message).toBe("Configuration or input has an invalid shape.");
    expect(error.path).toBeUndefined();
  });

  test("carries the core code and path", () => {
    const error = caught(() =>
      Redactor.create(
        JSON.stringify({ rules: { nope: { action: "redact" } } }),
      ),
    );

    expect(error.code).toBe("UNKNOWN_RULE");
    expect(error.path).toBe("rules");
  });

  test("never puts caller values in the path", () => {
    const stream = { ...ticket.stream, maxMatchLength: 0 };
    const error = caught(() =>
      Redactor.create(config({ detectors: [{ ...ticket, stream }] })),
    );

    expect(error.code).toBe("INVALID_CONFIG");
    expect(error.path).toBe("detectors.stream");
  });

  test("carries structured info", () => {
    const error = caught(() =>
      Redactor.create(JSON.stringify({ presets: ["pii@2"], rules: {} })),
    );

    expect(error.info).toEqual({ preset: "pii", availableVersions: [1] });
  });
});

describe("fast path", () => {
  const text = "😀 hello T-123";

  test("redact returns the text when nothing is detected", () => {
    expect(Redactor.create(config()).redact(text)).toBe(text);
  });

  test("redactWithMap and inspect carry the map only with restore", () => {
    const plain = Redactor.create(config());
    const restoring = Redactor.create(config({ restore: true }));

    expect(plain.redactWithMap(text)).toEqual({ text });
    expect(restoring.redactWithMap(text)).toEqual({ text, map: {} });
    expect(plain.inspect(text)).toEqual({ text, groups: [] });
    expect(restoring.inspect(text)).toEqual({ text, groups: [], map: {} });
  });

  test("throws INPUT_LIMIT past maxInputLength", () => {
    const redactor = Redactor.create(config({ limits: { maxInputLength: 4 } }));

    expect(caught(() => redactor.redact("12345")).code).toBe("INPUT_LIMIT");
    expect(redactor.redact("1234")).toBe("1234");
  });
});

describe("collect and render", () => {
  const text = "😀 ticket T-123, 🎉 and T-999.";

  test("collect returns no core detections for JS-only rules", () => {
    expect(Redactor.create(config()).collect(text)).toEqual([]);
  });

  test("renders JS detections with UTF-16 offsets", () => {
    const redactor = Redactor.create(config({ restore: true }));
    const detection = ticketAt(text, "T-999");

    const result = redactor.render(text, [detection], true);

    expect(result.text).toBe("😀 ticket T-123, 🎉 and [TICKET_1].");
    expect(result.map).toEqual({ "[TICKET_1]": "T-999" });
    expect(result.groups).toEqual([
      {
        start: detection.start,
        end: detection.end,
        replacement: "[TICKET_1]",
        matches: [{ ...detection, value: "T-999" }],
      },
    ]);

    expect(restore(result.text, result.map ?? {})).toBe(text);
  });

  test("skips groups unless reporting, and applies the allowlist", () => {
    const redactor = Redactor.create(config({ allowlist: ["T-123"] }));
    const detections = [ticketAt(text, "T-123"), ticketAt(text, "T-999")];

    expect(redactor.render(text, detections, false)).toEqual({
      text: "😀 ticket T-123, 🎉 and [TICKET].",
      groups: [],
    });
  });

  test("filter keeps only what render would", () => {
    const redactor = Redactor.create(config({ allowlist: ["T-123"] }));
    const kept = ticketAt(text, "T-999");

    expect(redactor.filter(text, [ticketAt(text, "T-123"), kept])).toEqual([
      kept,
    ]);
    expect(caught(() => redactor.filter(text, [{ ...kept, start: 1 }])).code).toBe(
      "DETECTOR_CONTRACT",
    );
  });

  test("throws DETECTOR_CONTRACT for bad detections", () => {
    const redactor = Redactor.create(config());
    const valid = ticketAt(text, "T-123");

    const bad: Detection[] = [
      { ...valid, ruleId: "email" },
      { ...valid, start: 1 }, // inside the surrogate pair of 😀
      { ...valid, end: text.length + 1 },
      { ...valid, end: valid.start },
    ];

    for (const detection of bad) {
      const error = caught(() => redactor.render(text, [detection], true));

      expect(error.code).toBe("DETECTOR_CONTRACT");
    }
  });
});

describe("stream", () => {
  const chunks = ["😀 hello ", "T-1", "23 and 🎉 bye"];

  test("passes text through and completes with the map when restoring", () => {
    const stream = Redactor.create(config()).stream(true, true);

    const events = [
      ...chunks.flatMap((c) => stream.push(c)),
      ...stream.finish(),
    ];

    expect(streamText(events)).toBe(chunks.join(""));
    expect(events.at(-1)).toEqual({ type: "complete", map: {} });
  });

  test("completes without a map by default", () => {
    const stream = Redactor.create(config()).stream(false);

    expect(stream.finish()).toEqual([{ type: "complete" }]);
  });

  test("is spent after finish", () => {
    const stream = Redactor.create(config()).stream(false);

    stream.finish();

    expect(() => stream.finish()).toThrow("Stream is already finished.");
    expect(() => stream.push("more")).toThrow("Stream is already finished.");
  });

  test("pushWith renders JS detections with one restoration map", () => {
    const text = "😀 T-123, T-123 and T-999.";
    const stream = Redactor.create(config({ restore: true })).stream(false);
    const detect = (buffer: string): Detection[] =>
      [...buffer.matchAll(/T-\d+/g)].map((m) => ({
        start: m.index,
        end: m.index + m[0].length,
        ruleId: "ticket_id",
        entityType: "ticket",
        reasons: [],
      }));

    const events = [
      ...stream.pushWith(text.slice(0, 9), detect),
      ...stream.pushWith(text.slice(9), detect),
      ...stream.finishWith(detect),
    ];

    expect(streamText(events)).toBe("😀 [TICKET_1], [TICKET_2] and [TICKET_3].");
    expect(events.at(-1)).toEqual({
      type: "complete",
      map: { "[TICKET_1]": "T-123", "[TICKET_2]": "T-123", "[TICKET_3]": "T-999" },
    });
  });

  test("pushWith rethrows what detect throws", () => {
    const stream = Redactor.create(config()).stream(false);
    const boom = new Error("boom");

    stream.push("T-1");

    expect(
      caught(() =>
        stream.finishWith(() => {
          throw boom;
        }),
      ),
    ).toBe(boom);
  });

  test("throws STREAM_UNSUPPORTED for rules without stream metadata", () => {
    const { stream: _, ...descriptor } = ticket;
    const redactor = Redactor.create(config({ detectors: [descriptor] }));

    expect(caught(() => redactor.stream(false)).code).toBe(
      "STREAM_UNSUPPORTED",
    );
  });
});

test("restore replaces known placeholders only", () => {
  expect(restore("[EMAIL_1] and [EMAIL_2]", { "[EMAIL_1]": "a@b.co" })).toBe(
    "a@b.co and [EMAIL_2]",
  );
});

test("describeJson lists enabled rules in policy order", () => {
  const redactor = Redactor.create(
    JSON.stringify({
      rules: { phone: { action: "redact" }, ticket_id: { action: "redact" } },
      detectors: [ticket],
    }),
  );

  const ids = JSON.parse(redactor.describeJson()).map(
    (d: { id: string }) => d.id,
  );

  expect(ids).toEqual(["phone", "ticket_id"]);
});

test("listDetectorsJson lists every built-in", () => {
  const listed = JSON.parse(listDetectorsJson());

  expect(listed[0]).toMatchObject({ id: "address", stream: true });
  expect(listed[0].contextHint.required).toBe(true);
  expect(listed.length).toBeGreaterThan(150);
});
