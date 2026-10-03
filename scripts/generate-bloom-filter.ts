import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Hash functions (must match runtime implementation exactly)
// ---------------------------------------------------------------------------

function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function djb2(text: string): number {
  let hash = 5381;

  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }

  return hash >>> 0;
}

// ---------------------------------------------------------------------------
// Bloom filter
// ---------------------------------------------------------------------------

class BloomFilter {
  readonly m: number;
  readonly k: number;
  readonly bits: Uint8Array;

  constructor(m: number, k: number) {
    this.m = m;
    this.k = k;
    this.bits = new Uint8Array(Math.ceil(m / 8));
  }

  add(str: string): void {
    const h1 = fnv1a32(str);
    const h2 = djb2(str);

    for (let i = 0; i < this.k; i++) {
      const pos = (h1 + i * h2) % this.m;
      this.bits[Math.floor(pos / 8)]! |= 1 << (pos % 8);
    }
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

// ---------------------------------------------------------------------------
// Name extraction
// ---------------------------------------------------------------------------

const isLatin = (s: string): boolean => /^[a-zA-Z][a-zA-Z\s\-'.]+$/.test(s);

function extractWikidataNames(): Set<string> {
  const male =
    require("../node_modules/wikidata-names/data/male.json") as string[];
  const female =
    require("../node_modules/wikidata-names/data/female.json") as string[];
  const family =
    require("../node_modules/wikidata-names/data/family.json") as string[];
  const unisex =
    require("../node_modules/wikidata-names/data/unisex.json") as string[];

  const names = new Set<string>();

  for (const n of male) {
    if (isLatin(n)) {
      names.add(n.toLowerCase());
    }
  }

  for (const n of female) {
    if (isLatin(n)) {
      names.add(n.toLowerCase());
    }
  }

  for (const n of family) {
    if (isLatin(n)) {
      names.add(n.toLowerCase());
    }
  }

  for (const n of unisex) {
    if (isLatin(n)) {
      names.add(n.toLowerCase());
    }
  }

  return names;
}

function extractCompromiseNames(): Set<string> {
  const unpack = require("efrt/unpack").default ?? require("efrt/unpack");
  const data = require("../node_modules/compromise/src/2-two/preTagger/model/lexicon/_data.js");

  const names = new Set<string>();

  for (const cat of ["MaleName", "FemaleName", "FirstName", "LastName"]) {
    const compressed = data.default[cat];

    if (!compressed) {
      continue;
    }

    const words = unpack(compressed);

    for (const w of Object.keys(words)) {
      if (isLatin(w)) {
        names.add(w.toLowerCase());
      }
    }
  }

  return names;
}

function extractFakerNames(): Set<string> {
  const locales = require("@faker-js/faker") as Record<string, unknown>;
  const names = new Set<string>();

  for (const locale of Object.values(locales)) {
    if (typeof locale !== "object" || locale === null) {
      continue;
    }

    const person = (locale as { person?: Record<string, unknown> }).person;

    if (!person) {
      continue;
    }

    const addArr = (arr: unknown): void => {
      if (Array.isArray(arr)) {
        for (const n of arr) {
          if (typeof n === "string" && isLatin(n)) {
            names.add(n.toLowerCase());
          }
        }
      }
    };

    addArr(person.first_name);
    addArr(person.last_name);
    addArr(person.middle_name);

    if (
      person.first_name &&
      typeof person.first_name === "object" &&
      !Array.isArray(person.first_name)
    ) {
      const fn = person.first_name as Record<string, unknown>;
      addArr(fn.generic);
      addArr(fn.female);
      addArr(fn.male);
    }
  }

  return names;
}

// ---------------------------------------------------------------------------
// Stopword generation
// ---------------------------------------------------------------------------

/**
 * Common English words that might be capitalized at sentence starts or in
 * title-case text. We check which of these are also in the name dataset
 * and include only those as stopwords (to prevent false-positive matches
 * on common words that happen to be names too).
 */
const COMMON_ENGLISH_WORDS = [
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "also",
  "among",
  "an",
  "and",
  "any",
  "are",
  "around",
  "as",
  "at",
  "away",
  "back",
  "bad",
  "be",
  "been",
  "before",
  "below",
  "between",
  "big",
  "black",
  "blue",
  "bone",
  "bones",
  "book",
  "born",
  "both",
  "box",
  "boy",
  "bring",
  "broke",
  "brown",
  "but",
  "buy",
  "can",
  "cannot",
  "care",
  "carry",
  "cat",
  "child",
  "close",
  "cloud",
  "cold",
  "come",
  "could",
  "coffee",
  "dark",
  "date",
  "day",
  "did",
  "do",
  "does",
  "dog",
  "done",
  "door",
  "down",
  "each",
  "ear",
  "early",
  "east",
  "eat",
  "end",
  "even",
  "ever",
  "every",
  "eye",
  "face",
  "fall",
  "family",
  "far",
  "fast",
  "father",
  "feel",
  "few",
  "fell",
  "find",
  "fire",
  "first",
  "fish",
  "five",
  "fix",
  "floor",
  "flower",
  "fly",
  "food",
  "foot",
  "for",
  "form",
  "four",
  "fox",
  "free",
  "from",
  "full",
  "game",
  "get",
  "girl",
  "give",
  "go",
  "gold",
  "good",
  "got",
  "great",
  "green",
  "grey",
  "gray",
  "group",
  "had",
  "hand",
  "hands",
  "has",
  "have",
  "he",
  "head",
  "hear",
  "heart",
  "help",
  "held",
  "her",
  "here",
  "hide",
  "high",
  "him",
  "his",
  "hold",
  "home",
  "hope",
  "horse",
  "hot",
  "house",
  "how",
  "hurt",
  "ice",
  "if",
  "in",
  "indeed",
  "into",
  "is",
  "it",
  "its",
  "job",
  "join",
  "just",
  "keep",
  "kind",
  "king",
  "know",
  "lane",
  "large",
  "last",
  "late",
  "later",
  "lay",
  "learn",
  "learned",
  "least",
  "leave",
  "left",
  "less",
  "let",
  "life",
  "light",
  "like",
  "line",
  "lines",
  "little",
  "live",
  "long",
  "look",
  "love",
  "low",
  "lung",
  "made",
  "make",
  "man",
  "many",
  "may",
  "me",
  "mean",
  "more",
  "most",
  "mother",
  "mountain",
  "mouth",
  "move",
  "much",
  "must",
  "my",
  "name",
  "near",
  "need",
  "new",
  "next",
  "night",
  "nine",
  "no",
  "nor",
  "north",
  "not",
  "note",
  "now",
  "number",
  "of",
  "off",
  "often",
  "old",
  "on",
  "once",
  "one",
  "only",
  "open",
  "or",
  "order",
  "other",
  "our",
  "out",
  "over",
  "own",
  "page",
  "pain",
  "part",
  "pass",
  "past",
  "pay",
  "people",
  "perhaps",
  "pick",
  "place",
  "plan",
  "play",
  "please",
  "point",
  "poor",
  "power",
  "press",
  "price",
  "probably",
  "problem",
  "put",
  "question",
  "quick",
  "quiet",
  "quite",
  "rain",
  "read",
  "real",
  "red",
  "remain",
  "report",
  "rest",
  "result",
  "rich",
  "ride",
  "right",
  "rise",
  "river",
  "road",
  "roof",
  "room",
  "round",
  "rose",
  "run",
  "ran",
  "said",
  "same",
  "sat",
  "saw",
  "say",
  "school",
  "sea",
  "second",
  "see",
  "seem",
  "self",
  "sell",
  "send",
  "sense",
  "set",
  "seven",
  "shall",
  "she",
  "ship",
  "short",
  "should",
  "show",
  "side",
  "silver",
  "since",
  "sit",
  "six",
  "sick",
  "small",
  "snow",
  "so",
  "some",
  "son",
  "soon",
  "south",
  "speak",
  "stand",
  "start",
  "state",
  "stay",
  "still",
  "stone",
  "stop",
  "street",
  "strong",
  "such",
  "sun",
  "sure",
  "take",
  "talk",
  "task",
  "tea",
  "tell",
  "ten",
  "test",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "thing",
  "think",
  "third",
  "this",
  "those",
  "though",
  "three",
  "through",
  "time",
  "tiny",
  "to",
  "today",
  "together",
  "too",
  "top",
  "toward",
  "train",
  "tree",
  "true",
  "try",
  "turn",
  "two",
  "under",
  "until",
  "up",
  "us",
  "use",
  "used",
  "very",
  "voice",
  "wait",
  "wake",
  "walk",
  "wall",
  "walls",
  "want",
  "war",
  "was",
  "water",
  "way",
  "we",
  "well",
  "west",
  "what",
  "when",
  "where",
  "which",
  "while",
  "white",
  "who",
  "why",
  "wide",
  "will",
  "win",
  "wind",
  "window",
  "winter",
  "wish",
  "with",
  "without",
  "woman",
  "wonder",
  "wood",
  "word",
  "work",
  "world",
  "would",
  "write",
  "won",
  "year",
  "yes",
  "yet",
  "you",
  "young",
  "your",
  "zero",
  // Days and months
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "january",
  "february",
  "march",
  "april",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  // Additional common words that may appear in title-case
  "apple",
  "autumn",
  "bird",
  "orange",
  "rice",
  "spring",
  "summer",
  "baby",
  "must",
  "can",
  "do",
  "about",
  "else",
  "begin",
  "broke",
  "nose",
  "car",
  "moon",
  "storm",
];

function generateStopwords(names: Set<string>): string[] {
  return COMMON_ENGLISH_WORDS.filter((w) => names.has(w));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("Extracting names from wikidata-names...");
  const wikiNames = extractWikidataNames();
  console.log(`  ${wikiNames.size} Latin-script names`);

  console.log("Extracting names from compromise lexicon...");
  const compromiseNames = extractCompromiseNames();
  console.log(`  ${compromiseNames.size} names`);

  console.log("Extracting names from faker locales...");
  const fakerNames = extractFakerNames();
  console.log(`  ${fakerNames.size} names`);

  const allNames = new Set<string>([
    ...wikiNames,
    ...compromiseNames,
    ...fakerNames,
  ]);
  console.log(`Total unique names: ${allNames.size}`);

  console.log("Generating stopwords...");
  const stopwords = generateStopwords(allNames);
  console.log(`  ${stopwords.length} stopwords`);

  const p = 0.001;
  const n = allNames.size;
  const m = Math.ceil((-n * Math.log(p)) / Math.log(2) ** 2);
  const k = Math.ceil((m / n) * Math.log(2));

  console.log(`Bloom filter: m=${m}, k=${k}, size=${Math.ceil(m / 8)} bytes`);

  console.log("Building bloom filter...");
  const bloom = new BloomFilter(m, k);

  for (const name of allNames) {
    bloom.add(name);
  }

  // Verify FPR on random strings
  let fpCount = 0;
  const testCount = 100_000;
  for (let i = 0; i < testCount; i++) {
    const len = 3 + Math.floor(Math.random() * 10);
    let s = "";
    for (let j = 0; j < len; j++) {
      s += String.fromCharCode(97 + Math.floor(Math.random() * 26));
    }
    if (!allNames.has(s) && bloom.has(s)) {
      fpCount++;
    }
  }
  console.log(`Measured FPR: ${((fpCount / testCount) * 100).toFixed(3)}%`);

  // Serialize to base64
  const bytes = bloom.bits;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const base64 = Buffer.from(binary, "binary").toString("base64");
  console.log(`Base64 size: ${Math.ceil(base64.length / 1024)} KB`);

  // Generate TypeScript file
  const outputPath = resolve(
    import.meta.dirname,
    "..",
    "src",
    "detectors",
    "person",
    "person-name-data.ts",
  );

  mkdirSync(dirname(outputPath), { recursive: true });

  const content = `// AUTO-GENERATED by scripts/generate-bloom-filter.ts — DO NOT EDIT.
// Source: wikidata-names + compromise lexicon + faker Latin locales
// ${allNames.size} names, ${stopwords.length} stopwords
// Bloom filter: m=${m}, k=${k}, FPR target 0.1%

export const BLOOM_M = ${m} as const;
export const BLOOM_K = ${k} as const;

export const BLOOM_FILTER_BASE64 = "${base64}";

export const STOPWORDS: ReadonlySet<string> = new Set(${JSON.stringify(stopwords)});
`;

  writeFileSync(outputPath, content);
  console.log(`Written to ${outputPath}`);
}

main();
