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
  toast,
} from "@bloodline/ui";
import { Building2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { post, useList, type Hospital } from "@/lib/operations";

function AddHospitalDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await post("/hospitals", {
        name: f.get("name"),
        phone: f.get("phone") || undefined,
        email: f.get("email") || undefined,
        address: f.get("address") || undefined,
      });
      toast.success("Hospital added");
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
      <Button onClick={() => setOpen(true)}>Add hospital</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add hospital</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required minLength={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function HospitalsPage() {
  const { can } = useAuth();
  const { data, loading, error, refetch } = useList<Hospital>("/hospitals");

  return (
    <>
      <PageHeader
        title="Hospitals"
        description="Partner hospitals, their doctors and request history."
        actions={can("hospitals", "create") ? <AddHospitalDialog onCreated={refetch} /> : undefined}
      />
      <Card className="overflow-hidden">
        <DataState
          loading={loading}
          error={error}
          data={data}
          onRetry={refetch}
          empty={<EmptyState icon={<Building2 className="size-6" />} title="No hospitals yet" />}
        >
          {(rows) => (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Doctors</th>
                  <th className="px-4 py-2.5 font-medium">Requests</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{h.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{h.phone ?? h.email ?? "—"}</td>
                    <td className="px-4 py-2.5"><Badge variant="default">{h._count?.doctors ?? 0}</Badge></td>
                    <td className="px-4 py-2.5"><Badge variant="default">{h._count?.requests ?? 0}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataState>
      </Card>
    </>
  );
}
