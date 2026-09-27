import type { RestorationMap } from "./types";

const PLACEHOLDER_PATTERN = /\[[A-Z][A-Z0-9_]*_\d+\]/g;

export function restore(text: string, map: RestorationMap): string {
  return text.replace(PLACEHOLDER_PATTERN, (match) => {
    return map[match] ?? match;
  });
}
