import { listDetectors } from "../../src/index";
import { printJSON, printTable } from "../output";

export interface ListDetectorsArgs {
  json?: boolean;
}

export async function listDetectorsCommand(
  args: ListDetectorsArgs,
): Promise<void> {
  const detectors = listDetectors();

  if (args.json) {
    printJSON(detectors);
    return;
  }

  const rows = detectors.map((d) => ({
    id: d.id,
    entityType: d.entityType,
    replacement: d.replacement,
    stream: d.stream ? "yes" : "no",
  }));

  printTable(
    [
      { header: "ID", width: 30, field: "id" },
      { header: "Entity Type", width: 30, field: "entityType" },
      { header: "Replacement", width: 20, field: "replacement" },
      { header: "Stream", width: 7, field: "stream" },
    ],
    rows,
  );
}
