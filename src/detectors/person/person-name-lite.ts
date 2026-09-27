import { fnv1a32 } from "../../hash";
import type { SemanticQuestion } from "../../semantic/types";
import type { Detection } from "../../types";
import { Detector } from "../base";
import {
  BLOOM_FILTER_BASE64,
  BLOOM_K,
  BLOOM_M,
  STOPWORDS,
} from "./person-name-data";

// ---------------------------------------------------------------------------
// Hash functions (must match the build script exactly)
// ---------------------------------------------------------------------------

function djb2(text: string): number {
  let hash = 5381;

  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }

  return hash >>> 0;
}

// ---------------------------------------------------------------------------
// Bloom filter (lazy-initialized)
// ---------------------------------------------------------------------------

class BloomFilter {
  private readonly bits: Uint8Array;

  constructor(
    base64: string,
    readonly m: number,
    readonly k: number,
  ) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    this.bits = bytes;
  }

  has(str: string): boolean {
    const h1 = fnv1a32(str);
    const h2 = djb2(str);

    for (let i = 0; i < this.k; i++) {
      const pos = (h1 + i * h2) % this.m;

      if ((this.bits[Math.floor(pos / 8)]! & (1 << (pos % 8))) === 0) {
        return false;
      }
    }

    return true;
  }
}

let bloom: BloomFilter | undefined;

function getBloom(): BloomFilter {
  if (bloom === undefined) {
    bloom = new BloomFilter(BLOOM_FILTER_BASE64, BLOOM_M, BLOOM_K);
  }

  return bloom;
}

// ---------------------------------------------------------------------------
// Name candidate regex
// ---------------------------------------------------------------------------

const honorifics = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."];
const suffixes = ["Jr.", "Sr.", "II", "III", "IV"];

const honorificPattern = honorifics
  .map((h) => h.replace(".", "\\.")) // escape dots
  .join("|");

const suffixPattern = suffixes.map((s) => s.replace(/\./g, "\\.")).join("|");

// Negative lookahead to prevent suffix words ("Jr", "Sr") from being
// consumed as regular capitalized words, leaving them for the suffix group.
const notSuffix = `(?!Jr\\b|Sr\\b)`;

// A single capitalized word that is not a suffix word.
const word = `${notSuffix}[A-Z][a-z]+`;

// Matches: optional honorific + 1-4 capitalized words + optional suffix
// e.g. "John Smith", "Dr. Jane Doe", "Robert Downey Jr.", "Martin Luther King Jr."
const namePattern = new RegExp(
  `(?:${honorificPattern})\\s+` + // honorific (required for single-word names)
    `${word}(?:\\s+${word}){0,3}` + // 1-4 capitalized words
    `(?:\\s+(?:${suffixPattern}))?` + // optional suffix
    `|` + // OR
    `${word}(?:\\s+${word}){1,3}` + // 2-4 capitalized words (no honorific)
    `(?:\\s+(?:${suffixPattern}))?`, // optional suffix
  "g",
);

const trailingPunctuation = /[.,;:)\]}>?!]$/;

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

export class PersonNameLiteDetector extends Detector {
  readonly id = "person_name_lite";
  readonly entityType = "person_name_lite";
  readonly replacement = "[PERSON_NAME]";

  override readonly stream = Object.freeze({
    maxMatchLength: 40,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override semanticConfirm(candidate: {
    readonly value: string;
    readonly before: string;
    readonly after: string;
  }): SemanticQuestion | undefined {
    return {
      instructions: {
        task: "Determine whether the candidate text refers to a specific individual person.",
        candidate: candidate.value,
        before: candidate.before,
        after: candidate.after,
      },
      criteria: {
        true: "The candidate is the name of a specific individual person (e.g. 'John Smith', 'Dr. Jane Doe').",
        false:
          "The candidate is a place, organization, product, title, or sentence-start word (e.g. 'New York', 'Apple Inc').",
      },
    };
  }

  override detect(text: string): Detection[] {
    const bf = getBloom();
    const candidates: Detection[] = [];

    namePattern.lastIndex = 0;

    for (const match of text.matchAll(namePattern)) {
      const start = match.index;
      const end = start + match[0].length;

      // Trim trailing punctuation (unless the match ends with a suffix like Jr.)
      let adjustedEnd = end;
      const matchText = text.slice(start, end);

      const endsWithSuffix = suffixes.some(
        (s) => matchText.endsWith(s) || matchText.endsWith(`${s}.`),
      );

      if (!endsWithSuffix) {
        while (
          adjustedEnd > start &&
          trailingPunctuation.test(text.slice(start, adjustedEnd))
        ) {
          adjustedEnd--;
        }
      }

      // Trim possessive 's
      if (text.slice(start, adjustedEnd).endsWith("'s")) {
        adjustedEnd -= 2;
      }

      if (start >= adjustedEnd) {
        continue;
      }

      // Extract the name words (without honorific/suffix) for bloom filter check
      const cleanMatch = text.slice(start, adjustedEnd);
      const words = cleanMatch
        .replace(/^(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+/, "")
        .replace(/(?:Jr\.|Sr\.|II|III|IV)$/, "")
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0);

      // Single-word name: must have had an honorific and word must be in bloom filter
      // Multi-word name: at least one word must be in bloom filter AND not in stopwords
      const hasHonorific = /^(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)/.test(cleanMatch);

      if (words.length === 1 && !hasHonorific) {
        continue;
      }

      if (words.length === 1 && hasHonorific) {
        // Single-word with honorific: check bloom filter only
        if (!bf.has(words[0]!.toLowerCase())) {
          continue;
        }
      } else {
        // Multi-word: at least one word must be in bloom filter AND not a stopword
        const hasNameWord = words.some(
          (w) => bf.has(w.toLowerCase()) && !STOPWORDS.has(w.toLowerCase()),
        );

        if (!hasNameWord) {
          continue;
        }
      }

      if (this.isAdjacentForbidden(text, start, adjustedEnd)) {
        continue;
      }

      candidates.push({
        start,
        end: adjustedEnd,
        ruleId: "person_name_lite",
        entityType: "person_name_lite",
        reasons: ["person_name_lite.bloom"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const personNameLiteDetector = new PersonNameLiteDetector();
