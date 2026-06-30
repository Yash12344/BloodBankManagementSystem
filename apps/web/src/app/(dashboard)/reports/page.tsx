"use client";

import { Button, Card, ListSkeleton, toast } from "@bloodline/ui";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api, ApiError } from "@/lib/api";

const TYPES = ["inventory", "donors", "collection", "issue", "lab", "finance"] as const;

interface ReportData {
  type: string;
  generatedAt: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

export default function ReportsPage() {
  const [type, setType] = useState<(typeof TYPES)[number]>("inventory");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  function qs(format: string) {
    const p = new URLSearchParams({ format });
    if (from) p.set("dateFrom", from);
    if (to) p.set("dateTo", to);
    return p.toString();
  }

  async function preview() {
    setLoading(true);
    try {
      setReport(await api<ReportData>(`/reports/${type}?${qs("json")}`));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  const [downloading, setDownloading] = useState<string | null>(null);

  async function download(format: "csv" | "xlsx" | "pdf") {
    setDownloading(format);
    try {
      const res = await fetch(`/api/v1/reports/${type}?${qs(format)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <>
      <PageHeader title="Reports" description="Generate operational and financial reports. Export as CSV, Excel or PDF." />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Report</label>
            <select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              {TYPES.map((t) => <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
          </div>
          <Button variant="outline" onClick={preview} disabled={loading}>Preview</Button>
          <Button variant="outline" onClick={() => download("csv")} disabled={downloading !== null}>
            {downloading === "csv" ? "…" : "CSV"}
          </Button>
          <Button variant="outline" onClick={() => download("xlsx")} disabled={downloading !== null}>
            {downloading === "xlsx" ? "…" : "Excel"}
          </Button>
          <Button onClick={() => download("pdf")} disabled={downloading !== null}>
            {downloading === "pdf" ? "…" : "PDF"}
          </Button>
        </div>
      </Card>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : report ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>{report.headers.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {report.rows.length === 0 ? (
                <tr><td colSpan={report.headers.length} className="px-3 py-8 text-center text-muted-foreground">No data for this range.</td></tr>
              ) : (
                report.rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {report.headers.map((h) => <td key={h} className="px-3 py-1.5">{String(row[h] ?? "")}</td>)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Choose a report and click Preview, or download directly.</p>
      )}
    </>
  );
}
