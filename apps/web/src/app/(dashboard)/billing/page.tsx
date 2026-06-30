"use client";

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
  Input,
  Label,
  ListSkeleton,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  toast,
} from "@bloodline/ui";
import { Receipt, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  createExpense,
  getAging,
  getDailyCash,
  getInvoice,
  getPriceList,
  recordPayment,
  updatePriceList,
  useExpenses,
  useInvoices,
  voidInvoice,
  type Aging,
  type DailyCash,
  type Invoice,
  type InvoiceDetail,
  type PriceItem,
} from "@/lib/billing";
import { formatMinor } from "@/lib/operations";

const STATUS_VARIANT: Record<string, "default" | "primary" | "success" | "warning" | "destructive"> = {
  DRAFT: "default",
  UNPAID: "warning",
  PARTIAL: "primary",
  PAID: "success",
  VOID: "destructive",
};

const INVOICE_STATUSES = ["", "DRAFT", "UNPAID", "PARTIAL", "PAID", "VOID"] as const;

function AddExpenseDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await createExpense({
        head: String(f.get("head")),
        amountMinor: Math.round(Number(f.get("amount")) * 100),
        notes: (f.get("notes") as string) || undefined,
      });
      toast.success("Expense recorded");
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record expense");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>Add expense</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="head">Head</Label>
            <Input id="head" name="head" required minLength={2} placeholder="e.g. Lab reagents" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" name="notes" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PriceListDialog({ canEdit }: { canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PriceItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) getPriceList().then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [open]);

  function setField(id: string, field: "priceMinor" | "gstRate", value: number) {
    setItems((prev) => prev?.map((it) => (it.id === id ? { ...it, [field]: value } : it)) ?? prev);
  }

  async function save() {
    if (!items) return;
    setBusy(true);
    try {
      await updatePriceList(items.map((it) => ({ componentType: it.componentType, bloodGroup: it.bloodGroup, priceMinor: it.priceMinor, gstRate: it.gstRate })));
      toast.success("Price list updated");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update price list");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>Price list</Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Price list</DialogTitle>
          <DialogDescription>Per-component pricing used to generate invoices on issue.</DialogDescription>
        </DialogHeader>
        {!items ? (
          <ListSkeleton rows={5} />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No price items configured.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Component</th>
                  <th className="py-2 font-medium">Group</th>
                  <th className="py-2 font-medium">Price (₹)</th>
                  <th className="py-2 font-medium">GST %</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="py-1.5">{it.componentType}</td>
                    <td className="py-1.5 text-muted-foreground">{it.bloodGroup ?? "All"}</td>
                    <td className="py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={!canEdit}
                        defaultValue={(it.priceMinor / 100).toFixed(2)}
                        onChange={(e) => setField(it.id, "priceMinor", Math.round(Number(e.target.value) * 100))}
                        className="h-8 w-24"
                      />
                    </td>
                    <td className="py-1.5">
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        disabled={!canEdit}
                        defaultValue={it.gstRate}
                        onChange={(e) => setField(it.id, "gstRate", Number(e.target.value))}
                        className="h-8 w-20"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canEdit && items && items.length > 0 && (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save prices"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function BillingPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const { data, loading, error, refetch } = useInvoices(status || undefined);
  const expenses = useExpenses();
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [cash, setCash] = useState<DailyCash | null>(null);
  const [aging, setAging] = useState<Aging | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDailyCash().then(setCash).catch(() => setCash(null));
    getAging().then(setAging).catch(() => setAging(null));
  }, [data, expenses.data]);

  async function open(inv: Invoice) {
    const r = await getInvoice(inv.id);
    setDetail(r.invoice);
  }

  async function pay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await recordPayment(detail.id, {
        method: String(f.get("method")),
        amountMinor: Math.round(Number(f.get("amount")) * 100),
        reference: (f.get("reference") as string) || undefined,
      });
      toast.success("Payment recorded");
      setDetail(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  async function onVoid() {
    if (!detail) return;
    const reason = window.prompt("Void this invoice? Enter a reason:");
    if (!reason) return;
    setBusy(true);
    try {
      await voidInvoice(detail.id, reason);
      toast.success("Invoice voided");
      setDetail(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Void failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Billing"
        description="Invoices generated on issue, payments, expenses and the daily cash book."
        actions={
          <div className="flex gap-2">
            {can("billing", "view") && <PriceListDialog canEdit={can("billing", "edit")} />}
            {can("billing", "create") && <AddExpenseDialog onSaved={expenses.refetch} />}
          </div>
        }
      />

      {cash && (
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Today in</div><div className="mt-1 text-xl font-semibold text-success">{formatMinor(cash.totalIn)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Today expenses</div><div className="mt-1 text-xl font-semibold text-destructive">{formatMinor(cash.totalExpense)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Net</div><div className="mt-1 text-xl font-semibold">{formatMinor(cash.net)}</div></Card>
          {aging && <Card className="p-4"><div className="text-xs text-muted-foreground">Outstanding</div><div className="mt-1 text-xl font-semibold text-warning">{formatMinor(aging.totalOutstanding)}</div></Card>}
        </div>
      )}

      {aging && aging.totalOutstanding > 0 && (
        <Card className="mb-4 p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Receivables aging</div>
          <div className="grid grid-cols-4 gap-3 text-sm">
            {(["0-30", "31-60", "61-90", "90+"] as const).map((b) => (
              <div key={b} className="rounded-md bg-secondary/40 p-2 text-center">
                <div className="text-xs text-muted-foreground">{b} days</div>
                <div className="mt-0.5 font-semibold">{formatMinor(aging.buckets[b] ?? 0)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s === "" ? "All statuses" : s}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        <DataState
          loading={loading}
          error={error}
          data={data}
          onRetry={refetch}
          empty={<EmptyState icon={<Receipt className="size-6" />} title="No invoices yet" description="Invoices are created when blood is issued." />}
        >
          {(rows) => (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Billed to</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                  <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.id} onClick={() => open(inv)} className="cursor-pointer border-b last:border-0 hover:bg-secondary/50">
                    <td className="px-4 py-2.5 font-medium">{inv.number}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{inv.hospital?.name ?? "Walk-in"}</td>
                    <td className="px-4 py-2.5 text-right">{formatMinor(inv.totalMinor)}</td>
                    <td className="px-4 py-2.5 text-right">{formatMinor(inv.balanceMinor)}</td>
                    <td className="px-4 py-2.5"><Badge variant={STATUS_VARIANT[inv.status] ?? "default"}>{inv.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataState>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-medium">
          <Wallet className="size-4 text-muted-foreground" /> Recent expenses
        </div>
        <DataState
          loading={expenses.loading}
          error={expenses.error}
          data={expenses.data}
          onRetry={expenses.refetch}
          empty={<EmptyState title="No expenses yet" description="Record an operating expense to see it here." />}
        >
          {(rows) => (
            <table className="w-full text-sm">
              <tbody>
                {rows.map((ex) => (
                  <tr key={ex.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{ex.head}{ex.notes && <span className="text-muted-foreground"> · {ex.notes}</span>}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{ex.spentAt.slice(0, 10)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-destructive">{formatMinor(ex.amountMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataState>
      </Card>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="sm:max-w-lg">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detail.number} <Badge variant={STATUS_VARIANT[detail.status] ?? "default"}>{detail.status}</Badge>
                </SheetTitle>
                <SheetDescription>{detail.hospital?.name ?? "Walk-in"} · {detail.issuedAt.slice(0, 10)}</SheetDescription>
              </SheetHeader>

              <div className="space-y-3 overflow-y-auto text-sm">
                <table className="w-full">
                  <tbody>
                    {detail.lines.map((l) => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-1.5">{l.description} <span className="text-muted-foreground">×{l.qty}</span></td>
                        <td className="py-1.5 text-right">{formatMinor(l.amountMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="space-y-1 text-right text-muted-foreground">
                  <div>Subtotal {formatMinor(detail.subtotalMinor)}</div>
                  <div>GST {formatMinor(detail.gstMinor)}</div>
                  <div className="font-semibold text-foreground">Total {formatMinor(detail.totalMinor)}</div>
                  <div className="font-semibold text-foreground">Balance {formatMinor(detail.balanceMinor)}</div>
                </div>

                {detail.payments.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Payments</div>
                    <ul className="divide-y">
                      {detail.payments.map((p) => (
                        <li key={p.id} className="flex justify-between py-1.5">
                          <span>{p.method}</span>
                          <span>{formatMinor(p.amountMinor)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mt-auto space-y-2 border-t pt-3">
                {can("billing", "create") && detail.balanceMinor > 0 && detail.status !== "VOID" && (
                  <form onSubmit={pay} className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="amount">Amount (₹)</Label>
                        <Input id="amount" name="amount" type="number" step="0.01" min="0.01" defaultValue={(detail.balanceMinor / 100).toFixed(2)} required />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="method">Method</Label>
                        <select id="method" name="method" defaultValue="CASH" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                          {["CASH", "CARD", "UPI", "CHEQUE", "BANK"].map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>{busy ? "Recording…" : "Record payment"}</Button>
                  </form>
                )}
                {can("billing", "edit") && detail.status !== "VOID" && detail.payments.length === 0 && (
                  <Button variant="ghost" className="w-full text-destructive" disabled={busy} onClick={onVoid}>
                    Void invoice
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
