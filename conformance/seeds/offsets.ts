import type { RenderSeed } from "../reference";
import type { JsonRedactorConfig } from "../types";
import { EMAIL, EMAIL_2, IPV4 } from "./values";

const REDACT: JsonRedactorConfig = {
  rules: { email: { action: "redact" }, ipv4: { action: "redact" } },
};

const MASK: JsonRedactorConfig = {
  rules: { email: { action: "mask" }, ipv4: { action: "mask" } },
};

/** Inputs whose UTF-16 offsets differ from code-point and byte offsets. */
const TEXTS: readonly { readonly name: string; readonly input: string }[] = [
  { name: "emoji-before", input: `😀 ${EMAIL}` },
  { name: "emoji-after", input: `${EMAIL} 😀` },
  { name: "emoji-between", input: `${EMAIL} 😀 ${IPV4}` },
  { name: "astral-math-between", input: `𝒳 ${EMAIL} 𝒴 ${IPV4} 𝒵` },
  { name: "zwj-family", input: `👨‍👩‍👧 ${EMAIL} 👩🏽‍💻 ${IPV4}` },
  { name: "flags", input: `🇺🇸🇯🇵 ${IPV4} 🏳️‍🌈` },
  { name: "combining-marks", input: `é ${EMAIL} ñö ${IPV4}` },
  { name: "cjk-spaced", input: `联系 ${EMAIL} 谢谢 ${IPV4}` },
  { name: "cjk-touching", input: `联系${EMAIL}谢谢` },
  { name: "rtl-hebrew", input: `שלום ${EMAIL} עולם` },
  { name: "rtl-arabic", input: `مرحبا ${IPV4} شكرا` },
  { name: "rtl-marks", input: `‫${EMAIL}‬ ‏${IPV4}‎` },
  { name: "emoji-touching", input: `😀${EMAIL}😀` },
  {
    name: "mixed",
    input: `Ünïcödé 😀 ${EMAIL} 联系 👨‍👩‍👧 ${IPV4} שלום é ${EMAIL_2} 🇯🇵`,
  },
];

function textSeeds(): RenderSeed[] {
  return TEXTS.flatMap(({ name, input }) => [
    { id: `redact/${name}`, config: REDACT, input },
    { id: `mask/${name}`, config: MASK, input },
  ]);
}

/** Matched values that themselves contain multi-unit graphemes. */
const GRAPHEME_MASK_SEEDS: readonly RenderSeed[] = [
  {
    id: "mask-graphemes/url-query-key/emoji-value",
    config: { rules: { url_query_key: { action: "mask" } } },
    input: "https://example.com/?api_key=😀👍🏽x&y=1",
  },
  {
    id: "mask-graphemes/url-query-key/preserve-first-last",
    config: {
      rules: {
        url_query_key: { action: "mask", preserve: { first: 1, last: 1 } },
      },
    },
    input: "https://example.com/?api_key=👨‍👩‍👧abc🇯🇵&y=1",
  },
  {
    id: "mask-graphemes/url-query-key/combining-marks",
    config: {
      rules: {
        url_query_key: { action: "mask", preserve: { first: 2 } },
      },
    },
    input: "https://example.com/?token=ééxyz&y=1",
  },
  {
    id: "mask-graphemes/url-with-auth/preserve-first-last",
    config: {
      rules: {
        url_with_auth: { action: "mask", preserve: { first: 8, last: 2 } },
      },
    },
    input: "https://usér:pässwörd@exämple.com/😀 x",
  },
  {
    id: "format-preserve-graphemes/url-query-key",
    config: { rules: { url_query_key: { action: "format-preserve" } } },
    input: "https://example.com/?api_key=café😀42&y=1",
  },
  {
    id: "token-replace-graphemes/url-query-key",
    config: { rules: { url_query_key: { action: "token-replace" } } },
    input: "😀 https://example.com/?api_key=café😀42&y=1",
  },
  {
    id: "remove-graphemes/url-query-key",
    config: { rules: { url_query_key: { action: "remove" } } },
    input: "😀 https://example.com/?api_key=café😀42&y=1 😀",
  },
];

export const offsetSeeds: readonly RenderSeed[] = [
  ...textSeeds(),
  ...GRAPHEME_MASK_SEEDS,
];
