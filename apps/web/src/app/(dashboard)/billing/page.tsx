"use client";

import {
  Badge,
  Button,
  Card,
  DataState,
  EmptyState,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  toast,
} from "@bloodline/ui";
import { Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getDailyCash, getInvoice, recordPayment, useInvoices, type DailyCash, type Invoice, type InvoiceDetail } from "@/lib/billing";
import { formatMinor } from "@/lib/operations";

const STATUS_VARIANT: Record<string, "default" | "primary" | "success" | "warning" | "destructive"> = {
  DRAFT: "default",
  UNPAID: "warning",
  PARTIAL: "primary",
  PAID: "success",
  VOID: "destructive",
};

export default function BillingPage() {
  const { can } = useAuth();
  const { data, loading, error, refetch } = useInvoices();
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [cash, setCash] = useState<DailyCash | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDailyCash().then(setCash).catch(() => setCash(null));
  }, [data]);

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

  return (
    <>
      <PageHeader title="Billing" description="Invoices generated on issue, payments and the daily cash book." />

      {cash && (
        <div className="mb-4 grid grid-cols-3 gap-4">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Today in</div><div className="mt-1 text-xl font-semibold text-success">{formatMinor(cash.totalIn)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Today expenses</div><div className="mt-1 text-xl font-semibold text-destructive">{formatMinor(cash.totalExpense)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Net</div><div className="mt-1 text-xl font-semibold">{formatMinor(cash.net)}</div></Card>
        </div>
      )}

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

              {can("billing", "create") && detail.balanceMinor > 0 && detail.status !== "VOID" && (
                <form onSubmit={pay} className="mt-auto space-y-2 border-t pt-3">
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
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
