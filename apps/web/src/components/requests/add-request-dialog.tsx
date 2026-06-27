"use client";

import { BLOOD_GROUPS, BLOOD_GROUP_LABEL, COMPONENT_TYPES } from "@bloodline/types";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Label, toast } from "@bloodline/ui";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { createRequest } from "@/lib/requests";

const FIELD = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function AddRequestDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await createRequest({
        bloodGroup: f.get("bloodGroup"),
        componentType: f.get("componentType"),
        unitsRequested: f.get("unitsRequested"),
        priority: f.get("priority"),
        channel: f.get("channel"),
      });
      toast.success("Request created");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>New request</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New blood request</DialogTitle>
          <DialogDescription>Critical requests are surfaced as emergencies.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bloodGroup">Blood group</Label>
              <select id="bloodGroup" name="bloodGroup" defaultValue="O_POS" className={FIELD}>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>{BLOOD_GROUP_LABEL[g]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="componentType">Component</Label>
              <select id="componentType" name="componentType" defaultValue="PRBC" className={FIELD}>
                {COMPONENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unitsRequested">Units</Label>
              <Input id="unitsRequested" name="unitsRequested" type="number" min="1" defaultValue="1" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <select id="priority" name="priority" defaultValue="NORMAL" className={FIELD}>
                <option value="NORMAL">Normal</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="channel">Channel</Label>
            <select id="channel" name="channel" defaultValue="HOSPITAL" className={FIELD}>
              <option value="HOSPITAL">Hospital</option>
              <option value="ONLINE">Online</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
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
