import { restore } from "./restore";
import type { RestorationMap } from "./types";

export class StreamRestorer {
  private held = "";

  constructor(private readonly map: RestorationMap) {}

  push(chunk: string): string {
    const text = this.held + chunk;
    const open = text.lastIndexOf("[");

    // Hold back only a tail that can still grow into a placeholder in the
    // map; anything else would pass through `restore` unchanged anyway.
    if (open !== -1 && this.isPartialPlaceholder(text.slice(open))) {
      this.held = text.slice(open);

      return restore(text.slice(0, open), this.map);
    }

    this.held = "";

    return restore(text, this.map);
  }

  flush(): string {
    const result = restore(this.held, this.map);
    this.held = "";
    return result;
  }

  private isPartialPlaceholder(tail: string): boolean {
    for (const placeholder of Object.keys(this.map)) {
      if (placeholder.length > tail.length && placeholder.startsWith(tail)) {
        return true;
      }
    }

    return false;
  }
}
