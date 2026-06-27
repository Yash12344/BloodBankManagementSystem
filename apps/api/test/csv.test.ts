import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "../src/lib/csv.js";

describe("csv", () => {
  it("serializes and escapes fields with commas, quotes and newlines", () => {
    const csv = toCsv(["name", "note"], [{ name: "A, B", note: 'say "hi"\nok' }]);
    expect(csv).toContain('"A, B"');
    expect(csv).toContain('"say ""hi""\nok"');
  });

  it("round-trips a parsed record", () => {
    const csv = toCsv(["name", "mobile"], [{ name: "Rohit Mehta", mobile: "98990" }]);
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Rohit Mehta", mobile: "98990" });
  });

  it("parses quoted fields containing commas", () => {
    const rows = parseCsv('name,note\r\n"Smith, J","a,b,c"');
    expect(rows[0]).toMatchObject({ name: "Smith, J", note: "a,b,c" });
  });

  it("handles empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
