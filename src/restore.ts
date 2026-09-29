import { PLACEHOLDER_PATTERN } from "./placeholders";
import type { RestorationMap } from "./types";

export function restore(text: string, map: RestorationMap): string {
  return text.replace(PLACEHOLDER_PATTERN, (match) => {
    return map[match] ?? match;
  });
}
