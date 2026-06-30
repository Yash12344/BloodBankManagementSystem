/**
 * PDF serialization for the report engine. Renders the generic `{ headers, rows }` report
 * shape as a paginated, branded table in landscape A4 and resolves to a Node Buffer.
 *
 * Uses pdfkit with the built-in Helvetica font (no external font assets), so it works in
 * the bundled API image without shipping font files. Long cell values are clipped with an
 * ellipsis to keep the grid aligned; page breaks re-draw the column header.
 */
import PDFDocument from "pdfkit";

interface Printable {
  type: string;
  generatedAt: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

const MARGIN = 36;
const ROW_H = 18;
const BRAND = "#E11D48";
const INK = "#0F172A";
const MUTED = "#64748B";
const LINE = "#E2E8F0";

export function toPdfBuffer(report: Printable, opts: { title: string; range?: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const usableW = doc.page.width - MARGIN * 2;
    const headers = report.headers;
    const colW = headers.length > 0 ? usableW / headers.length : usableW;
    const bottom = doc.page.height - MARGIN;

    // --- Title block ---
    doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(18).text("BloodLine");
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(13).text(`${opts.title} report`);
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9)
      .text(`Generated ${new Date(report.generatedAt).toLocaleString()}${opts.range ? ` · ${opts.range}` : ""}`);
    doc.moveDown(0.75);

    const drawCells = (cells: string[], bold: boolean) => {
      const y = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(bold ? MUTED : INK);
      cells.forEach((c, i) => {
        doc.text(c, MARGIN + i * colW + 2, y + 4, { width: colW - 4, height: ROW_H - 4, ellipsis: true, lineBreak: false });
      });
      doc.strokeColor(LINE).moveTo(MARGIN, y + ROW_H).lineTo(MARGIN + usableW, y + ROW_H).stroke();
      doc.y = y + ROW_H;
    };

    const drawHeader = () => drawCells(headers, true);

    drawHeader();
    if (report.rows.length === 0) {
      doc.moveDown(0.5).fillColor(MUTED).font("Helvetica").fontSize(9).text("No data for this range.", MARGIN, doc.y + 4);
    } else {
      for (const row of report.rows) {
        if (doc.y + ROW_H > bottom) {
          doc.addPage();
          drawHeader();
        }
        drawCells(
          headers.map((h) => {
            const v = row[h];
            return v === null || v === undefined ? "" : String(v);
          }),
          false,
        );
      }
    }

    doc.end();
  });
}
