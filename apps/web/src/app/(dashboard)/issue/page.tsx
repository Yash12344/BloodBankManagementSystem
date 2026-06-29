"use client";

import { BLOOD_GROUP_LABEL } from "@bloodline/types";
import {
  Badge,
  Button,
  Card,
  DataState,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  toast,
} from "@bloodline/ui";
import { Send } from "lucide-react";
import { useState } from "react";
import { FulfilDrawer } from "@/components/requests/fulfil-drawer";
import { PageHeader } from "@/components/page-header";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getIssue, returnIssue, useIssues, type IssueDetail, type IssueRow, type IssueStatus } from "@/lib/issues";
import { formatMinor } from "@/lib/operations";
import { escapeHtml, printDocument } from "@/lib/print";
import { useRequests } from "@/lib/requests";

function groupLabel(g: string) {
  return BLOOD_GROUP_LABEL[g as keyof typeof BLOOD_GROUP_LABEL] ?? g;
}

const STATUS_VARIANT: Record<string, "default" | "primary" | "success" | "warning" | "destructive"> = {
  ISSUED: "success",
  RETURNED: "warning",
  CANCELLED: "default",
};

function printSlip(issue: IssueDetail) {
  const rows = issue.items
    .map(
      (it) =>
        `<tr><td>${escapeHtml(it.component.barcode)}</td><td>${escapeHtml(it.component.type)}</td><td>${escapeHtml(
          groupLabel(it.component.bloodGroup),
        )}</td><td style="text-align:right">${formatMinor(it.priceMinor)}</td></tr>`,
    )
    .join("");
  const body = `
    <div class="brand"><h1>Blood Issue Slip</h1><span class="logo">BloodLine</span></div>
    <div class="kv">
      <div><span>Issue ID</span><br/>${escapeHtml(issue.id)}</div>
      <div><span>Issued at</span><br/>${escapeHtml(new Date(issue.issuedAt).toLocaleString())}</div>
      <div><span>Patient</span><br/>${escapeHtml(issue.patient?.name ?? "—")}</div>
      <div><span>Hospital</span><br/>${escapeHtml(issue.hospital?.name ?? "—")}</div>
      <div><span>Invoice</span><br/>${escapeHtml(issue.invoice?.number ?? "—")}</div>
      <div><span>Status</span><br/>${escapeHtml(issue.status)}</div>
    </div>
    <table>
      <thead><tr><th>Barcode</th><th>Component</th><th>Group</th><th style="text-align:right">Price</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${
      issue.invoice
        ? `<div class="total">Subtotal ${formatMinor(issue.invoice.subtotalMinor)} · GST ${formatMinor(
            issue.invoice.gstMinor,
          )} · Total ${formatMinor(issue.invoice.totalMinor)}</div>`
        : ""
    }
    <div class="foot">
      <div class="muted">Generated ${escapeHtml(new Date().toLocaleString())}</div>
      <div class="sign">Issued by</div>
    </div>`;
  printDocument(`Issue ${issue.invoice?.number ?? issue.id}`, body);
}

/** Picks an approved request to fulfil, then hands off to the shared FulfilDrawer. */
function IssueAgainstRequest({ onIssued }: { onIssued: () => void }) {
  const [open, setOpen] = useState(false);
  const [fulfilId, setFulfilId] = useState<string | null>(null);
  const { data, loading, error, refetch } = useRequests("APPROVED");

  return (
    <>
      <Button onClick={() => setOpen(true)}>Issue blood</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue against an approved request</DialogTitle>
            <DialogDescription>
              Units are reserved at approval time. Pick a request to cross-match and issue.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            <DataState
              loading={loading}
              error={error}
              data={data}
              onRetry={refetch}
              empty={<EmptyState title="No approved requests" description="Approve a request first." />}
            >
              {(rows) => (
                <ul className="divide-y text-sm">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setFulfilId(r.id);
                          setOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-2 py-2.5 text-left hover:bg-secondary/50"
                      >
                        <span>
                          <span className="font-medium">{r.unitsRequested}× </span>
                          {groupLabel(r.bloodGroup)} {r.componentType}
                          <span className="text-muted-foreground"> · {r.patient?.name ?? r.hospital?.name ?? "—"}</span>
                        </span>
                        {r.priority === "CRITICAL" && <Badge variant="destructive">Critical</Badge>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </DataState>
          </div>
        </DialogContent>
      </Dialog>

      <FulfilDrawer
        requestId={fulfilId}
        onDone={() => {
          setFulfilId(null);
          onIssued();
        }}
      />
    </>
  );
}

export default function IssuePage() {
  const { can } = useAuth();
  const [status, setStatus] = useState<IssueStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, refetch } = useIssues({ status, dateFrom, dateTo, page });

  const [selected, setSelected] = useState<IssueDetail | null>(null);
  const [busy, setBusy] = useState(false);

  async function openDetail(row: IssueRow) {
    try {
      const r = await getIssue(row.id);
      setSelected(r.issue);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load issue");
    }
  }

  async function onReturn(issue: IssueDetail, restock: boolean) {
    const reason = window.prompt(`${restock ? "Restock" : "Discard"} returned units — reason (optional):`) ?? undefined;
    setBusy(true);
    try {
      const res = await returnIssue(issue.id, restock, reason);
      toast.success(`Returned · ${res.restocked} restocked, ${res.discarded} discarded`);
      setSelected(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Return failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Issue"
        description="Issue cross-matched units against approved requests and track every hand-over."
        actions={can("issue", "create") ? <IssueAgainstRequest onIssued={refetch} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as IssueStatus | "");
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ISSUED">Issued</option>
          <option value="RETURNED">Returned</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="To date"
        />
        {(status || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("");
              setDateFrom("");
              setDateTo("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <DataState
          loading={loading}
          error={error}
          data={data}
          onRetry={refetch}
          empty={
            <EmptyState
              icon={<Send className="size-6" />}
              title="No issues yet"
              description="Issue blood against an approved request to see it here."
            />
          }
        >
          {(rows) => (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">For</th>
                  <th className="px-4 py-2.5 font-medium">Units</th>
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Issued</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r)}
                    className="cursor-pointer border-b last:border-0 hover:bg-secondary/50"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{r.patient?.name ?? r.hospital?.name ?? "—"}</div>
                      {r.patient && r.hospital && (
                        <div className="text-xs text-muted-foreground">{r.hospital.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r._count.items}</td>
                    <td className="px-4 py-2.5">
                      {r.invoice ? (
                        <span>
                          <span className="font-mono text-xs">{r.invoice.number}</span>{" "}
                          <span className="text-muted-foreground">· {formatMinor(r.invoice.totalMinor)}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.issuedAt.slice(0, 10)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANT[r.status] ?? "default"}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataState>
      </Card>

      {meta && meta.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {meta.page} of {Math.max(1, Math.ceil(meta.total / meta.limit))} · {meta.total} total
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(meta.total / meta.limit)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.patient?.name ?? selected.hospital?.name ?? "Issue"}{" "}
                  <Badge variant={STATUS_VARIANT[selected.status] ?? "default"}>{selected.status}</Badge>
                </SheetTitle>
                <SheetDescription>
                  {selected.hospital?.name ?? "—"} · {new Date(selected.issuedAt).toLocaleString()}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Components</p>
                  <ul className="divide-y rounded-md border">
                    {selected.items.map((it) => (
                      <li key={it.id} className="flex items-center justify-between px-3 py-2">
                        <span className="font-mono text-xs">{it.component.barcode}</span>
                        <span className="flex items-center gap-2">
                          <Badge variant="primary">{groupLabel(it.component.bloodGroup)}</Badge>
                          <span className="text-muted-foreground">{it.component.type}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {selected.invoice && (
                  <div className="rounded-md bg-secondary/50 p-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoice</span>
                      <span className="font-mono text-xs">{selected.invoice.number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatMinor(selected.invoice.subtotalMinor)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GST</span>
                      <span>{formatMinor(selected.invoice.gstMinor)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>{formatMinor(selected.invoice.totalMinor)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-auto space-y-2">
                <Button variant="outline" className="w-full" onClick={() => printSlip(selected)}>
                  Print issue slip
                </Button>
                {selected.status === "ISSUED" && can("issue", "create") && (
                  <>
                    <Button variant="outline" className="w-full" disabled={busy} onClick={() => onReturn(selected, true)}>
                      Return &amp; restock (within cold-chain)
                    </Button>
                    <Button variant="destructive" className="w-full" disabled={busy} onClick={() => onReturn(selected, false)}>
                      Return &amp; discard
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
