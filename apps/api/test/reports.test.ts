import { describe, expect, it } from "vitest";
import { toPdfBuffer } from "../src/lib/pdf.js";
import { toXlsxBuffer } from "../src/lib/xlsx.js";

// Exercises the binary report serializers end-to-end (no DB): this is what proves the
// exceljs/pdfkit dependencies load under ESM and emit well-formed files.
const sample = {
  type: "inventory",
  generatedAt: new Date("2026-06-30T00:00:00Z").toISOString(),
  headers: ["bloodGroup", "component", "available"],
  rows: [
    { bloodGroup: "O+", component: "PRBC", available: 5 },
    { bloodGroup: "A-", component: "FFP", available: 0 },
  ],
};

describe("xlsx export", () => {
  it("produces a valid .xlsx (ZIP) buffer", async () => {
    const buf = await toXlsxBuffer(sample);
    expect(buf.length).toBeGreaterThan(0);
    // An .xlsx is a ZIP container — its first two bytes are 'PK'.
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it("handles an empty result set", async () => {
    const buf = await toXlsxBuffer({ ...sample, rows: [] });
    expect(buf.length).toBeGreaterThan(0);
  });
});

describe("pdf export", () => {
  it("produces a valid PDF buffer", async () => {
    const buf = await toPdfBuffer(sample, { title: "Inventory" });
    expect(buf.length).toBeGreaterThan(0);
    // A PDF file begins with the '%PDF' magic header.
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  it("handles an empty result set and a date range", async () => {
    const buf = await toPdfBuffer({ ...sample, rows: [] }, { title: "Inventory", range: "2026-06-01 to 2026-06-30" });
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});
