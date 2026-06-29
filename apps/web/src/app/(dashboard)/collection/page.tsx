"use client";

import { BLOOD_GROUP_LABEL } from "@bloodline/types";
import {
  Badge,
  Button,
  Card,
  DataState,
  EmptyState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  toast,
} from "@bloodline/ui";
import { Droplet } from "lucide-react";
import { useState } from "react";
import { RecordCollectionDialog } from "@/components/collection/record-collection-dialog";
import { PageHeader } from "@/components/page-header";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  getCollection,
  setCollectionStatus,
  useCollections,
  type CollectionDetail,
  type CollectionRow,
  type CollectionStatus,
} from "@/lib/collections";
import { escapeHtml, printDocument } from "@/lib/print";

function groupLabel(g: string) {
  return BLOOD_GROUP_LABEL[g as keyof typeof BLOOD_GROUP_LABEL] ?? g;
}

const STATUS_VARIANT: Record<string, "default" | "primary" | "success" | "warning" | "destructive"> = {
  COLLECTED: "primary",
  PROCESSING: "warning",
  COMPLETED: "success",
  REJECTED: "destructive",
};

const NEXT_STATUS: Record<CollectionStatus, CollectionStatus[]> = {
  COLLECTED: ["PROCESSING", "REJECTED"],
  PROCESSING: ["COMPLETED", "REJECTED"],
  COMPLETED: [],
  REJECTED: [],
};

function printReceipt(c: CollectionDetail) {
  const body = `
    <div class="brand"><h1>Blood Collection Receipt</h1><span class="logo">BloodLine</span></div>
    <div class="kv">
      <div><span>Donor</span><br/>${escapeHtml(c.donor.name)} (${escapeHtml(c.donor.donorCode)})</div>
      <div><span>Blood group</span><br/>${escapeHtml(groupLabel(c.donor.bloodGroup))}</div>
      <div><span>Mobile</span><br/>${escapeHtml(c.donor.mobile)}</div>
      <div><span>Collected at</span><br/>${escapeHtml(new Date(c.collectedAt).toLocaleString())}</div>
      <div><span>Bag number</span><br/>${escapeHtml(c.unit?.bagNumber ?? "—")}</div>
      <div><span>Volume</span><br/>${escapeHtml(c.volumeMl)} ml</div>
      <div><span>Type</span><br/>${escapeHtml(c.donationType)}</div>
      <div><span>Source</span><br/>${escapeHtml(c.source)}${c.camp ? ` · ${escapeHtml(c.camp.name)}` : ""}</div>
      <div><span>Screening</span><br/>${escapeHtml(c.unit?.labTest?.result ?? "PENDING")}</div>
      <div><span>Status</span><br/>${escapeHtml(c.status)}</div>
    </div>
    <div class="foot">
      <div class="muted">Generated ${escapeHtml(new Date().toLocaleString())}</div>
      <div class="sign">Authorised signatory</div>
    </div>`;
  printDocument(`Collection ${c.unit?.bagNumber ?? c.id}`, body);
}

export default function CollectionPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState<CollectionStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, refetch } = useCollections({ status, dateFrom, dateTo, page });

  const [selected, setSelected] = useState<CollectionDetail | null>(null);
  const [busy, setBusy] = useState(false);

  async function openDetail(row: CollectionRow) {
    try {
      const r = await getCollection(row.id);
      setSelected(r.collection);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load collection");
    }
  }

  async function changeStatus(id: string, next: CollectionStatus) {
    setBusy(true);
    try {
      await setCollectionStatus(id, next);
      toast.success(`Marked ${next.toLowerCase()}`);
      setSelected(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Collection"
        description="Record donations and track every bag from collection to processing."
        actions={can("collection", "create") ? <RecordCollectionDialog onCreated={refetch} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as CollectionStatus | "");
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="COLLECTED">Collected</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Rejected</option>
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
              icon={<Droplet className="size-6" />}
              title="No collections yet"
              description="Record your first donation to get started."
            />
          }
        >
          {(rows) => (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Donor</th>
                  <th className="px-4 py-2.5 font-medium">Group</th>
                  <th className="px-4 py-2.5 font-medium">Bag</th>
                  <th className="px-4 py-2.5 font-medium">Volume</th>
                  <th className="px-4 py-2.5 font-medium">Collected</th>
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
                      <div className="font-medium">{r.donor.name}</div>
                      <div className="text-xs text-muted-foreground">{r.donor.donorCode}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="primary">{groupLabel(r.donor.bloodGroup)}</Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.unit?.bagNumber ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.volumeMl} ml</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.collectedAt.slice(0, 10)}</td>
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
                  {selected.donor.name} <Badge variant="primary">{groupLabel(selected.donor.bloodGroup)}</Badge>
                </SheetTitle>
                <SheetDescription>
                  {selected.donor.donorCode} · bag {selected.unit?.bagNumber ?? "—"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3 text-sm">
                <Row label="Collected" value={new Date(selected.collectedAt).toLocaleString()} />
                <Row label="Volume" value={`${selected.volumeMl} ml`} />
                <Row label="Type" value={selected.donationType} />
                <Row label="Source" value={selected.camp ? `${selected.source} · ${selected.camp.name}` : selected.source} />
                <Row label="Unit status" value={selected.unit?.status ?? "—"} />
                <Row label="Screening" value={selected.unit?.labTest?.result ?? "PENDING"} />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={STATUS_VARIANT[selected.status] ?? "default"}>{selected.status}</Badge>
                </div>
              </div>

              <div className="mt-auto space-y-2">
                <Button variant="outline" className="w-full" onClick={() => printReceipt(selected)}>
                  Print receipt
                </Button>
                {can("collection", "edit") &&
                  NEXT_STATUS[selected.status].map((next) => (
                    <Button
                      key={next}
                      variant={next === "REJECTED" ? "destructive" : "primary"}
                      className="w-full"
                      disabled={busy}
                      onClick={() => changeStatus(selected.id, next)}
                    >
                      Mark {next.toLowerCase()}
                    </Button>
                  ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
