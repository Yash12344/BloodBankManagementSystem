/**
 * Excel (.xlsx) serialization for the report engine. Takes the same
 * `{ headers, rows }` shape the CSV/JSON exports use, so every report type gets an Excel
 * export for free. Returns a Node Buffer ready to stream as an attachment.
 */
import ExcelJS from "exceljs";

interface Sheetable {
  type: string;
  generatedAt: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

export async function toXlsxBuffer(report: Sheetable): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BloodLine";
  wb.created = new Date(report.generatedAt);

  const ws = wb.addWorksheet(report.type.slice(0, 31) || "Report");
  ws.columns = report.headers.map((h) => ({
    header: h,
    key: h,
    width: Math.min(40, Math.max(12, h.length + 2)),
  }));

  // Bold header row with a subtle fill.
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

  for (const row of report.rows) {
    const record: Record<string, unknown> = {};
    for (const h of report.headers) record[h] = row[h] ?? "";
    ws.addRow(record);
  }

  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as unknown as ArrayBuffer);
}
