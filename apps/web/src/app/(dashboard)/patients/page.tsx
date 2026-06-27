"use client";

import { BLOOD_GROUPS, BLOOD_GROUP_LABEL } from "@bloodline/types";
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
import { UserRound } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { createPatient, usePatients } from "@/lib/patients";

const FIELD = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function groupLabel(g: string | null) {
  return g ? (BLOOD_GROUP_LABEL[g as keyof typeof BLOOD_GROUP_LABEL] ?? g) : "—";
}

function AddPatientDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await createPatient({
        name: f.get("name"),
        age: f.get("age") || undefined,
        bloodGroup: f.get("bloodGroup") || undefined,
        diagnosis: f.get("diagnosis") || undefined,
      });
      toast.success("Patient added");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add patient");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>Add patient</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add patient</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required minLength={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="age">Age</Label>
              <Input id="age" name="age" type="number" min="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bloodGroup">Blood group</Label>
              <select id="bloodGroup" name="bloodGroup" defaultValue="" className={FIELD}>
                <option value="">Unknown</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>{BLOOD_GROUP_LABEL[g]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Input id="diagnosis" name="diagnosis" />
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

export default function PatientsPage() {
  const { can } = useAuth();
  const { data, loading, error, refetch } = usePatients();

  return (
    <>
      <PageHeader
        title="Patients"
        description="Patients receiving blood, linked to hospitals and requests."
        actions={can("patients", "create") ? <AddPatientDialog onCreated={refetch} /> : undefined}
      />
      <Card className="overflow-hidden">
        <DataState
          loading={loading}
          error={error}
          data={data}
          onRetry={refetch}
          empty={<EmptyState icon={<UserRound className="size-6" />} title="No patients yet" />}
        >
          {(rows) => (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Group</th>
                  <th className="px-4 py-2.5 font-medium">Diagnosis</th>
                  <th className="px-4 py-2.5 font-medium">Hospital</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">
                      {p.name}
                      {p.age != null && <span className="text-muted-foreground"> · {p.age}y</span>}
                    </td>
                    <td className="px-4 py-2.5"><Badge variant="primary">{groupLabel(p.bloodGroup)}</Badge></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.diagnosis ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.hospital?.name ?? "—"}</td>
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
