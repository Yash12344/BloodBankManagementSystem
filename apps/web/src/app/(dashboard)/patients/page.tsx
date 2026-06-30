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
import { createPatient, deletePatient, updatePatient, usePatients, type Patient } from "@/lib/patients";

const FIELD = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function groupLabel(g: string | null) {
  return g ? (BLOOD_GROUP_LABEL[g as keyof typeof BLOOD_GROUP_LABEL] ?? g) : "—";
}

/** Add or edit a patient. When `patient` is provided the form is prefilled and PATCHes. */
function PatientDialog({
  patient,
  open,
  onOpenChange,
  onSaved,
}: {
  patient?: Patient | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = !!patient;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const body = {
      name: f.get("name"),
      age: f.get("age") || undefined,
      bloodGroup: f.get("bloodGroup") || undefined,
      diagnosis: f.get("diagnosis") || undefined,
    };
    try {
      if (editing) await updatePatient(patient.id, body);
      else await createPatient(body);
      toast.success(editing ? "Patient updated" : "Patient added");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save patient");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit patient" : "Add patient"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required minLength={2} defaultValue={patient?.name ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="age">Age</Label>
              <Input id="age" name="age" type="number" min="0" defaultValue={patient?.age ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bloodGroup">Blood group</Label>
              <select id="bloodGroup" name="bloodGroup" defaultValue={patient?.bloodGroup ?? ""} className={FIELD}>
                <option value="">Unknown</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>{BLOOD_GROUP_LABEL[g]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Input id="diagnosis" name="diagnosis" defaultValue={patient?.diagnosis ?? ""} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save" : "Add"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PatientsPage() {
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, refetch } = usePatients({ q: q || undefined, page });

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onDelete(p: Patient) {
    if (!window.confirm(`Delete patient ${p.name}?`)) return;
    setBusyId(p.id);
    try {
      await deletePatient(p.id);
      toast.success("Patient deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete patient");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Patients"
        description="Patients receiving blood, linked to hospitals and requests."
        actions={can("patients", "create") ? <Button onClick={() => setAdding(true)}>Add patient</Button> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by name…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>

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
                  {(can("patients", "edit") || can("patients", "delete")) && <th className="px-4 py-2.5 font-medium text-right">Actions</th>}
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
                    {(can("patients", "edit") || can("patients", "delete")) && (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          {can("patients", "edit") && (
                            <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Edit</Button>
                          )}
                          {can("patients", "delete") && (
                            <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === p.id} onClick={() => onDelete(p)}>Delete</Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataState>
      </Card>

      {meta && meta.total > meta.limit && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {meta.page} of {meta.totalPages} · {meta.total} patients</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <PatientDialog open={adding} onOpenChange={setAdding} onSaved={refetch} />
      <PatientDialog patient={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />
    </>
  );
}
