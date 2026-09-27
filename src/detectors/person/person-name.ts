import { SensoredError } from "../../errors";
import type { Detection } from "../../types";
import { Detector } from "../base";

interface PersonTerm {
  readonly tags: readonly string[];
}

interface PersonMatch {
  readonly offset: {
    readonly start: number;
    readonly length: number;
  };
  readonly terms: readonly PersonTerm[];
}

type NlpFunction = (text: string) => {
  people: () => {
    out: (format: string) => readonly PersonMatch[];
  };
};

let nlpFn: NlpFunction | null | undefined;

function getNlp(): NlpFunction | null {
  if (nlpFn === undefined) {
    try {
      const compromise = require("compromise");
      nlpFn = compromise.default ?? compromise;
    } catch {
      nlpFn = null;
    }
  }

  return nlpFn ?? null;
}

const trailingPunctuation = /[.,;:)\]}>?!]$/;

export class PersonNameDetector extends Detector {
  readonly id = "person_name";
  readonly entityType = "person_name";
  readonly replacement = "[PERSON_NAME]";

  override readonly stream = Object.freeze({
    maxMatchLength: 40,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const nlp = getNlp();

    if (nlp === null) {
      throw new SensoredError("INVALID_CONFIG", "person_name", {
        dependency: "compromise",
        install: "bun add compromise",
      });
    }

    const candidates: Detection[] = [];
    const people = nlp(text).people().out("offset");

    for (const person of people) {
      const start = person.offset.start;
      let end = start + person.offset.length;

      const lastTerm = person.terms[person.terms.length - 1];
      const isAbbreviation = lastTerm?.tags.includes("Abbreviation") ?? false;

      if (!isAbbreviation) {
        while (
          end > start &&
          trailingPunctuation.test(text.slice(start, end))
        ) {
          end--;
        }
      }

      if (text.slice(start, end).endsWith("'s")) {
        end -= 2;
      }

      if (start >= end) {
        continue;
      }

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "person_name",
        entityType: "person_name",
        reasons: ["person_name.ner"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const personNameDetector = new PersonNameDetector();
