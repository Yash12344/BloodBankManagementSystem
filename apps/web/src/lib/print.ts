"use client";

/**
 * Opens a clean, self-contained print window for a receipt/slip. We render into a fresh
 * document (not the app DOM) so the print output carries none of the dashboard chrome and
 * needs no print-specific CSS sprinkled through the app. Returns silently if the browser
 * blocks the popup.
 */
export function printDocument(title: string, bodyHtml: string): void {
  const win = window.open("", "_blank", "width=720,height=900");
  if (!win) {
    // Popup blocked — fall back to the current window's print dialog is too disruptive;
    // surface nothing here and let the caller decide. Most browsers allow user-initiated
    // popups (this runs from a click handler), so this is rare.
    return;
  }
  win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 32px; }
      h1 { font-size: 20px; margin: 0; }
      .brand { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #e11d48; padding-bottom: 12px; margin-bottom: 20px; }
      .brand .logo { color: #e11d48; font-weight: 700; letter-spacing: 0.02em; }
      .muted { color: #64748b; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
      th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
      th { color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
      .kv { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 13px; margin: 12px 0; }
      .kv div span { color: #64748b; }
      .total { text-align: right; font-weight: 700; font-size: 15px; margin-top: 8px; }
      .foot { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
      .sign { border-top: 1px solid #94a3b8; padding-top: 6px; width: 200px; text-align: center; }
      @media print { body { margin: 16px; } }
    </style>
  </head>
  <body>${bodyHtml}
    <script>window.onload = function () { window.focus(); window.print(); };</script>
  </body>
</html>`);
  win.document.close();
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
