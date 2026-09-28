import { describe, expect, it } from "bun:test";
import { formatJSON, formatTable } from "../output";

describe("formatTable", () => {
  it("formats a simple table", () => {
    const result = formatTable(
      [
        { header: "ID", width: 10, field: "id" },
        { header: "Name", width: 10, field: "name" },
      ],
      [
        { id: "email", name: "Email" },
        { id: "phone", name: "Phone" },
      ],
    );

    const lines = result.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("ID");
    expect(lines[0]).toContain("Name");
    expect(lines[1]).toContain("-");
    expect(lines[2]).toContain("email");
    expect(lines[2]).toContain("Email");
    expect(lines[3]).toContain("phone");
    expect(lines[3]).toContain("Phone");
  });

  it("handles empty rows", () => {
    const result = formatTable([{ header: "ID", width: 5, field: "id" }], []);
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("ID");
    expect(lines[1]).toContain("-");
  });

  it("handles missing field values", () => {
    const result = formatTable(
      [{ header: "ID", width: 10, field: "id" }],
      [{ id: "" }],
    );
    expect(result).toContain("          ");
  });
});

describe("formatJSON", () => {
  it("formats an object with indentation", () => {
    const result = formatJSON({ a: 1, b: "test" });
    expect(result).toBe('{\n  "a": 1,\n  "b": "test"\n}');
  });

  it("formats an array", () => {
    const result = formatJSON([1, 2, 3]);
    expect(result).toBe("[\n  1,\n  2,\n  3\n]");
  });

  it("formats null", () => {
    const result = formatJSON(null);
    expect(result).toBe("null");
  });
});
