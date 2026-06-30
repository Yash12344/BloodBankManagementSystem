"use client";

import { BLOOD_GROUPS, BLOOD_GROUP_LABEL } from "@bloodline/types";
import {
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
import { updateDonor, type Donor } from "@/lib/donors";

const FIELD =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Edit a donor's demographic fields (PATCH /donors/:id). */
export function EditDonorDialog({ donor, onClose, onSaved }: { donor: Donor | null; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!donor) return;
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await updateDonor(donor.id, {
        name: f.get("name"),
        dob: f.get("dob"),
        gender: f.get("gender"),
        bloodGroup: f.get("bloodGroup"),
        weightKg: f.get("weightKg"),
        mobile: f.get("mobile"),
        email: f.get("email") || "",
      });
      toast.success("Donor updated");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update donor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!donor} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit donor</DialogTitle>
          <DialogDescription>Update the donor&apos;s details. Eligibility is recomputed automatically.</DialogDescription>
        </DialogHeader>
        {donor && (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-name">Full name</Label>
              <Input id="e-name" name="name" required minLength={2} defaultValue={donor.name} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-dob">Date of birth</Label>
                <Input id="e-dob" name="dob" type="date" required defaultValue={donor.dob.slice(0, 10)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-gender">Gender</Label>
                <select id="e-gender" name="gender" defaultValue={donor.gender} className={FIELD}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-bloodGroup">Blood group</Label>
                <select id="e-bloodGroup" name="bloodGroup" defaultValue={donor.bloodGroup} className={FIELD}>
                  {BLOOD_GROUPS.map((g) => (
                    <option key={g} value={g}>{BLOOD_GROUP_LABEL[g]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-weightKg">Weight (kg)</Label>
                <Input id="e-weightKg" name="weightKg" type="number" step="0.1" min="1" required defaultValue={donor.weightKg} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-mobile">Mobile</Label>
                <Input id="e-mobile" name="mobile" required minLength={7} defaultValue={donor.mobile} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-email">Email (optional)</Label>
                <Input id="e-email" name="email" type="email" defaultValue={donor.email ?? ""} />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
