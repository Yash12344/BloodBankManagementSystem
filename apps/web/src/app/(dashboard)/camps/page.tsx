"use client";

import {
  Badge,
  Button,
  Card,
  DataState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Tent } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMinor, get, post, useList, type Camp, type CampStats } from "@/lib/operations";

const STATUS_VARIANT: Record<string, "default" | "primary" | "success" | "warning"> = {
  UPCOMING: "primary",
  ONGOING: "warning",
  COMPLETED: "success",
  CANCELLED: "default",
};

function AddCampDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await post("/camps", {
        name: f.get("name"),
        location: f.get("location"),
        scheduledDate: f.get("scheduledDate"),
        organizer: f.get("organizer") || undefined,
      });
      toast.success("Camp created");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>New camp</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New blood camp</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required minLength={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" required minLength={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="scheduledDate">Date</Label>
              <Input id="scheduledDate" name="scheduledDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organizer">Organizer</Label>
              <Input id="organizer" name="organizer" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CampsPage() {
  const { can } = useAuth();
  const { data, loading, error, refetch } = useList<Camp>("/camps");
  const [stats, setStats] = useState<{ camp: Camp; stats?: CampStats } | null>(null);

  async function openStats(camp: Camp) {
    setStats({ camp });
    try {
      const s = await get<CampStats>(`/camps/${camp.id}/stats`);
      setStats({ camp, stats: s });
    } catch {
      setStats({ camp });
    }
  }

  return (
    <>
      <PageHeader
        title="Blood camps"
        description="Plan camps; collections at a camp roll up into its statistics."
        actions={can("camps", "create") ? <AddCampDialog onCreated={refetch} /> : undefined}
      />
      <Card className="overflow-hidden">
        <DataState
          loading={loading}
          error={error}
          data={data}
          onRetry={refetch}
          empty={<EmptyState icon={<Tent className="size-6" />} title="No camps planned" />}
        >
          {(rows) => (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Camp</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Collections</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} onClick={() => openStats(c)} className="cursor-pointer border-b last:border-0 hover:bg-secondary/50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.location}</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.scheduledDate.slice(0, 10)}</td>
                    <td className="px-4 py-2.5"><Badge variant="default">{c._count?.donations ?? 0}</Badge></td>
                    <td className="px-4 py-2.5"><Badge variant={STATUS_VARIANT[c.status] ?? "default"}>{c.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataState>
      </Card>

      <Sheet open={!!stats} onOpenChange={(o) => !o && setStats(null)}>
        <SheetContent>
          {stats && (
            <>
              <SheetHeader>
                <SheetTitle>{stats.camp.name}</SheetTitle>
                <SheetDescription>{stats.camp.location} · {stats.camp.scheduledDate.slice(0, 10)}</SheetDescription>
              </SheetHeader>
              {stats.stats ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Collections" value={stats.stats.collections} />
                  <Stat label="Unique donors" value={stats.stats.uniqueDonors} />
                  <Stat label="Volume" value={`${stats.stats.volumeMl} ml`} />
                  <Stat label="Net" value={formatMinor(stats.stats.finance.netMinor)} />
                  <Stat label="Expenses" value={formatMinor(stats.stats.finance.expenseMinor)} />
                  <Stat label="Revenue" value={formatMinor(stats.stats.finance.revenueMinor)} />
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading stats…</p>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
