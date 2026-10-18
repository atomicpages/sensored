import type { RestoreSeed } from "../reference";
import { EMAIL, EMAIL_2 } from "./values";

const MAP = {
  "[EMAIL_1]": EMAIL,
  "[EMAIL_2]": EMAIL_2,
  "[IPV4_1]": "192.0.2.10",
};

/** Longer than `StreamRestorer` holds back for a partial placeholder. */
const LONG_ENTITY = "A".repeat(40);

export const restoreSeeds: readonly RestoreSeed[] = [
  {
    id: "edge/known-placeholders",
    input: "From [EMAIL_1] to [EMAIL_2] via [IPV4_1].",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/repeated-placeholder",
    input: "[EMAIL_1], again [EMAIL_1].",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/unknown-placeholder",
    input: "Known [EMAIL_1], unknown [EMAIL_9] and [PHONE_1].",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/adjacent-placeholders",
    input: "[EMAIL_1][EMAIL_2][IPV4_1]",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/nested-brackets",
    input: "[[EMAIL_1]] and [[IPV4_1]",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/partial-placeholder-at-end",
    input: "Trailing [EMAIL_",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/partial-placeholder-no-underscore",
    input: "Trailing [EMAIL",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/partial-placeholder-missing-bracket",
    input: "Trailing [EMAIL_1",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/open-bracket-at-end",
    input: "Trailing [",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/partial-then-text",
    input: "[EMAIL_ is not [EMAIL_1",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/closing-only",
    input: "EMAIL_1] and IPV4_1]",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/not-placeholders",
    input: "[email_1] [EMAIL] [EMAIL_] [_1] [1_EMAIL_1] [EMAIL_1a]",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/unnumbered-in-map",
    input: "[EMAIL] and [REDACTED]",
    map: { "[EMAIL]": EMAIL, "[REDACTED]": "x" },
    streamed: true,
  },
  {
    id: "edge/value-is-placeholder-no-recursion",
    input: "[A_1] then [B_1]",
    map: { "[A_1]": "[B_1]", "[B_1]": "done" },
    streamed: true,
  },
  {
    id: "edge/value-has-replacement-patterns",
    input: "[A_1]",
    map: { "[A_1]": "$& $1 $$ $`" },
    streamed: true,
  },
  {
    id: "edge/empty-map",
    input: "[EMAIL_1] stays.",
    map: {},
    streamed: true,
  },
  {
    id: "edge/empty-input",
    input: "",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/large-counter",
    input: "[EMAIL_1234567890]",
    map: { "[EMAIL_1234567890]": EMAIL },
    streamed: true,
  },
  {
    id: "edge/long-entity-type",
    input: `Value [${LONG_ENTITY}_1] end`,
    map: { [`[${LONG_ENTITY}_1]`]: EMAIL },
    streamed: true,
  },
  {
    id: "edge/astral-around-placeholders",
    input: "😀[EMAIL_1]👨‍👩‍👧[IPV4_1]🇯🇵",
    map: MAP,
    streamed: true,
  },
  {
    id: "edge/astral-value",
    input: "Hi [A_1]!",
    map: { "[A_1]": "😀 José 联系" },
    streamed: true,
  },
  {
    id: "edge/many-open-brackets",
    input: "[[[[[[[[EMAIL_2]",
    map: MAP,
    streamed: true,
  },
  {
    id: "complete-only/long-input",
    input: `${"[EMAIL_1] ".repeat(40)}end`,
    map: MAP,
    streamed: false,
  },
];
