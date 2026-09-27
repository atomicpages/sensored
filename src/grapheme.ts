const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

export interface Grapheme {
  readonly segment: string;
  readonly index: number;
}

export function segment(text: string): Grapheme[] {
  return [...segmenter.segment(text)];
}

export function graphemeBoundaries(text: string): Set<number> {
  const boundaries = new Set<number>([text.length]);

  for (const { index } of segmenter.segment(text)) {
    boundaries.add(index);
  }

  return boundaries;
}

/**
 * Check whether a single position falls on a grapheme cluster boundary.
 *
 * ASCII characters (U+0000–U+007F) are always individual grapheme clusters,
 * so any position between two ASCII characters is a boundary — no segmenter
 * iteration needed.  For non-ASCII text a small window around the position
 * is segmented to avoid scanning the entire string.
 */
export function graphemeBoundaryAt(text: string, position: number): boolean {
  if (position === 0 || position === text.length) {
    return true;
  }

  if (position < 0 || position > text.length) {
    return false;
  }

  const before = text.charCodeAt(position - 1);
  const at = text.charCodeAt(position);

  // ASCII fast path: every position between ASCII characters is a boundary.
  if (before < 0x80 && at < 0x80) {
    return true;
  }

  // Non-ASCII: segment a small window around the position.
  const windowStart = Math.max(0, position - 64);
  const windowEnd = Math.min(text.length, position + 64);

  for (const { index } of segmenter.segment(
    text.slice(windowStart, windowEnd),
  )) {
    if (windowStart + index === position) {
      return true;
    }
  }

  return false;
}

/**
 * Check which endpoints are grapheme-aligned, returning only the aligned ones.
 *
 * Avoids building a Set of every boundary position in the text (O(n) memory
 * for large inputs).  ASCII endpoints are resolved in O(1); non-ASCII
 * endpoints are batched into a single segmenter pass over the text.
 */
export function graphemeAlignedEndpoints(
  text: string,
  endpoints: number[],
): Set<number> {
  const aligned = new Set<number>();
  const nonAscii: number[] = [];

  for (const pos of endpoints) {
    if (pos === 0 || pos === text.length) {
      aligned.add(pos);
      continue;
    }

    if (pos < 0 || pos > text.length) {
      continue;
    }

    const before = text.charCodeAt(pos - 1);
    const at = text.charCodeAt(pos);

    if (before < 0x80 && at < 0x80) {
      aligned.add(pos);
    } else {
      nonAscii.push(pos);
    }
  }

  if (nonAscii.length > 0) {
    const sorted = [...new Set(nonAscii)].sort((a, b) => a - b);
    let posIdx = 0;

    for (const { index } of segmenter.segment(text)) {
      while (posIdx < sorted.length) {
        const target = sorted[posIdx];

        if (target === undefined) {
          break;
        }

        if (target < index) {
          posIdx++;
          continue;
        }

        if (target === index) {
          aligned.add(target);
          posIdx++;
          continue;
        }

        break;
      }

      if (posIdx >= sorted.length) {
        break;
      }
    }
  }

  return aligned;
}

export function isGraphemeAligned(
  text: string,
  positions: Iterable<number>,
): boolean {
  for (const position of positions) {
    if (!graphemeBoundaryAt(text, position)) {
      return false;
    }
  }

  return true;
}
