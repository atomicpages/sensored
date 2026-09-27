import type { DetectorDefinition } from "./types";

export const employeeIdLabelPattern =
  /(?:^|[^\p{L}\p{M}\p{N}_])Employee ID[ \t]{0,8}[:#]?[ \t]{0,8}$/iu;

export const employeeIdExample: DetectorDefinition = {
  id: "employee_id_example",
  entityType: "employee_id",
  replacement: "[EMPLOYEE_ID]",
  pattern: /(?<![\p{L}\p{M}\p{N}_])[A-Z]{2}\d{6}(?![\p{L}\p{M}\p{N}_])/u,
  context: { before: 20, after: 0 },
  stream: {
    maxMatchLength: 8,
    leftContext: 20,
    rightContext: 0,
    boundaryLookaround: 1,
  },
  validate({ before }) {
    if (employeeIdLabelPattern.test(before)) {
      return ["employee_id_example.context"];
    }

    return false;
  },
};
