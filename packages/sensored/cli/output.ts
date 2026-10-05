import { bold, cyan, dim } from "./colors";

export interface Column {
  readonly header: string;
  readonly width: number;
  readonly field: string;
}

export function formatTable(
  columns: readonly Column[],
  rows: readonly Record<string, string>[],
): string {
  const headerRow = columns
    .map((col) => bold(col.header.padEnd(col.width)))
    .join("  ");

  const separator = dim(columns.map((col) => "-".repeat(col.width)).join("  "));

  const dataRows = rows.map((row) =>
    columns
      .map((col) => {
        const value = row[col.field] ?? "";
        return value.padEnd(col.width);
      })
      .join("  "),
  );

  return [headerRow, separator, ...dataRows].join("\n");
}

export function formatJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function printTable(
  columns: readonly Column[],
  rows: readonly Record<string, string>[],
): void {
  process.stdout.write(`${formatTable(columns, rows)}\n`);
}

export function printJSON(data: unknown): void {
  process.stdout.write(`${formatJSON(data)}\n`);
}

export function printInfo(message: string): void {
  process.stderr.write(`${cyan("info")} ${message}\n`);
}
