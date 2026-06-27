/**
 * Minimal, dependency-free CSV serializer/parser supporting quoted fields, embedded
 * commas/quotes/newlines, and a header row. Sufficient for donor import/export; swap for
 * a streaming library if very large files become a concern.
 */

function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.map(escapeField).join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const v = row[h];
          return escapeField(v === null || v === undefined ? "" : String(v));
        })
        .join(","),
    );
  }
  return lines.join("\r\n");
}

/** Parses CSV text into an array of header-keyed records. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // Handle CRLF: skip the \n following a \r.
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // Flush trailing field/row if file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
  if (nonEmpty.length === 0) return [];

  const headers = (nonEmpty[0] ?? []).map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (r[idx] ?? "").trim();
    });
    return record;
  });
}
