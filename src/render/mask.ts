import type { AppliedMatch } from "../engine";
import { segment } from "../grapheme";

/**
 * Render a mask: preserve first/last N graphemes, hide the rest with "*".
 *
 * When preserve counts overflow the match length, the entire span is hidden.
 * Overlapping masks union their hidden regions before rendering.
 */
export function renderMask(
  text: string,
  matches: AppliedMatch[],
  start: number,
  end: number,
): string {
  const hidden: { start: number; end: number }[] = [];

  for (const { detection, rule } of matches) {
    if (rule.setting.action !== "mask") {
      continue;
    }

    const graphemes = segment(text.slice(detection.start, detection.end));

    const first = rule.setting.preserve?.first ?? 0;
    const last = rule.setting.preserve?.last ?? 0;
    const overflow = first + last >= graphemes.length;

    let hiddenStart: number;
    let hiddenEnd: number;

    if (overflow) {
      hiddenStart = detection.start;
      hiddenEnd = detection.end;
    } else {
      hiddenStart = detection.start + (graphemes[first]?.index ?? 0);

      if (last === 0) {
        hiddenEnd = detection.end;
      } else {
        hiddenEnd =
          detection.start + (graphemes[graphemes.length - last]?.index ?? 0);
      }
    }

    hidden.push({ start: hiddenStart, end: hiddenEnd });
  }

  hidden.sort((a, b) => a.start - b.start);

  let interval = 0;
  const result: string[] = [];

  for (const grapheme of segment(text.slice(start, end))) {
    const position = start + grapheme.index;

    while (
      interval < hidden.length &&
      (hidden[interval]?.end ?? Infinity) <= position
    ) {
      interval++;
    }

    const currentInterval = hidden[interval];
    const isHidden =
      currentInterval !== undefined && currentInterval.start <= position;

    result.push(isHidden ? "*" : grapheme.segment);
  }

  return result.join("");
}
