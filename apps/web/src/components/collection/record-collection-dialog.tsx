"use client";

import { BLOOD_GROUP_LABEL } from "@bloodline/types";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast,
} from "@bloodline/ui";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { createCollection } from "@/lib/collections";
import { useDonors, type Donor } from "@/lib/donors";

const FIELD =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function groupLabel(g: string) {
  return BLOOD_GROUP_LABEL[g as keyof typeof BLOOD_GROUP_LABEL] ?? g;
}

/** Register a donation: search a donor, then capture bag details (with a reasoned override). */
export function RecordCollectionDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [donor, setDonor] = useState<Donor | null>(null);
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only query once the user has typed something selective.
  const { data: results, loading } = useDonors({ q: q.trim().length >= 2 ? q.trim() : undefined });

  function reset() {
    setQ("");
    setDonor(null);
    setOverride(false);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!donor) return;
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await createCollection({
        donorId: donor.id,
        volumeMl: Number(form.get("volumeMl")),
        donationType: form.get("donationType"),
        source: form.get("source"),
        override,
        overrideReason: override ? String(form.get("overrideReason") ?? "") : undefined,
      });
      toast.success(`Collection recorded · bag ${res.unit.bagNumber}`);
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record collection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Button onClick={() => setOpen(true)}>Record collection</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record collection</DialogTitle>
          <DialogDescription>Find the donor, then capture the bag details.</DialogDescription>
        </DialogHeader>

        {!donor ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="donor-search">Search donor</Label>
              <Input
                id="donor-search"
                placeholder="Name, code or mobile…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border">
              {q.trim().length < 2 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Type at least 2 characters.</p>
              ) : loading ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Searching…</p>
              ) : !results || results.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">No matching donors.</p>
              ) : (
                <ul className="divide-y">
                  {results.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setDonor(d)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-secondary/50"
                      >
                        <span>
                          <span className="font-medium">{d.name}</span>
                          <span className="text-muted-foreground"> · {d.donorCode} · {d.mobile}</span>
                        </span>
                        <Badge variant="primary">{groupLabel(d.bloodGroup)}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="flex items-center justify-between rounded-md bg-secondary/50 p-3 text-sm">
              <div>
                <div className="font-medium">{donor.name}</div>
                <div className="text-xs text-muted-foreground">
                  {donor.donorCode} · {donor.mobile}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="primary">{groupLabel(donor.bloodGroup)}</Badge>
                <Button type="button" size="sm" variant="ghost" onClick={() => setDonor(null)}>
                  Change
                </Button>
              </div>
            </div>

            {!donor.eligibility.eligible && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                <p className="font-medium text-warning">Donor is not currently eligible</p>
                {donor.eligibility.reasons.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-muted-foreground">
                    {donor.eligibility.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                <label className="mt-2 flex items-center gap-2 text-foreground">
                  <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                  Override with a documented reason
                </label>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="volumeMl">Volume (ml)</Label>
                <Input id="volumeMl" name="volumeMl" type="number" min={100} max={550} defaultValue={450} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="donationType">Type</Label>
                <select id="donationType" name="donationType" defaultValue="VOLUNTARY" className={FIELD}>
                  <option value="VOLUNTARY">Voluntary</option>
                  <option value="REPLACEMENT">Replacement</option>
                </select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="source">Source</Label>
                <select id="source" name="source" defaultValue="WALK_IN" className={FIELD}>
                  <option value="WALK_IN">Walk-in</option>
                  <option value="HOSPITAL">Hospital</option>
                </select>
              </div>
            </div>

            {override && (
              <div className="space-y-1.5">
                <Label htmlFor="overrideReason">Override reason</Label>
                <Input id="overrideReason" name="overrideReason" required={override} minLength={3} />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || (!donor.eligibility.eligible && !override)}>
                {busy ? "Saving…" : "Record"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
