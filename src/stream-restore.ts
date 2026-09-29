import { PARTIAL_PATTERN } from "./placeholders";
import { restore } from "./restore";
import { DEFAULT_TOKEN_GENERATORS } from "./token-generators";
import type { RestorationMap } from "./types";

const MAX_PARTIAL_LENGTH = Math.max(
  ...Object.keys(DEFAULT_TOKEN_GENERATORS).map(
    (k) => k.toUpperCase().length + 1 + 10 + 2,
  ),
);

export class StreamRestorer {
  private held = "";

  constructor(private readonly map: RestorationMap) {}

  push(chunk: string): string {
    const text = this.held + chunk;
    this.held = "";

    let holdFrom = -1;
    for (
      let i = text.length - 1;
      i >= 0 && text.length - i <= MAX_PARTIAL_LENGTH;
      i--
    ) {
      if (text[i] === "[") {
        const candidate = text.slice(i);
        if (PARTIAL_PATTERN.test(candidate)) {
          holdFrom = i;
        }
        break;
      }
    }

    let safe = text;
    if (holdFrom !== -1) {
      this.held = text.slice(holdFrom);
      safe = text.slice(0, holdFrom);
    }

    return restore(safe, this.map);
  }

  flush(): string {
    const result = restore(this.held, this.map);
    this.held = "";
    return result;
  }
}
