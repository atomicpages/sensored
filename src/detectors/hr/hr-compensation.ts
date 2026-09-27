import type { ContextHint, Detection } from "../../types";
import { createContextMatcher, Detector } from "../base";

const LEFT_CONTEXT = 40;
const RIGHT_CONTEXT = 20;

const LABEL_STRINGS = [
  "Salary",
  "Compensation",
  "Pay",
  "Wage",
  "Earning",
  "Benefits Plan No",
  "Insurance Plan ID",
  "Health-Plan No",
  "401K Account No",
  "403B No",
  "IRA No",
  "Retirement Account No",
  "Pension No",
] as const;

const { hasContext } = createContextMatcher(
  "(?:Salary|Compensation|Pay|Wage|Earning|Benefits Plan No|Insurance Plan ID|Health-Plan No|401K Account No|403B No|IRA No|Retirement Account No|Pension No)",
  LEFT_CONTEXT,
  RIGHT_CONTEXT,
);

export class HrCompensationDetector extends Detector {
  readonly id = "hr_compensation";
  readonly entityType = "hr_compensation";
  readonly replacement = "[HR_COMPENSATION]";

  override readonly stream = Object.freeze({
    maxMatchLength: 30,
    leftContext: LEFT_CONTEXT,
    rightContext: RIGHT_CONTEXT,
    boundaryLookaround: 1,
  });

  override get contextHint(): ContextHint {
    return Object.freeze({
      required: true,
      labels: Object.freeze([...LABEL_STRINGS]),
      position: "both" as const,
      window: Object.freeze({
        before: LEFT_CONTEXT,
        after: RIGHT_CONTEXT,
      }),
    });
  }

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];
    const seen = new Set<string>();

    for (const match of text.matchAll(
      /(?:[$£€¥]\s?)?\d[\d,]*(?:\.\d{1,2})?/gi,
    )) {
      const start = match.index!;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      if (!hasContext(text, start, end)) {
        continue;
      }

      const key = `${start}-${end}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      candidates.push({
        start,
        end,
        ruleId: "hr_compensation",
        entityType: "hr_compensation",
        reasons: ["hr_compensation.format", "hr_compensation.context"],
      });
    }

    for (const match of text.matchAll(/[A-Z0-9]{6,16}/gi)) {
      const start = match.index!;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      if (!/\d/.test(match[0])) {
        continue;
      }

      if (!hasContext(text, start, end)) {
        continue;
      }

      const key = `${start}-${end}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      candidates.push({
        start,
        end,
        ruleId: "hr_compensation",
        entityType: "hr_compensation",
        reasons: ["hr_compensation.format", "hr_compensation.context"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const hrCompensationDetector = new HrCompensationDetector();
