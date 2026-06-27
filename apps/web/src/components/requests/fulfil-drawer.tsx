"use client";

import { Badge, Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, toast } from "@bloodline/ui";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { crossMatch, getRequest, issueBlood, type RequestDetail } from "@/lib/requests";

/** Fulfilment drawer: cross-match the reserved units, then issue them atomically. */
export function FulfilDrawer({ requestId, onDone }: { requestId: string | null; onDone: () => void }) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setDetail(null);
      return;
    }
    getRequest(requestId).then((r) => setDetail(r.request)).catch(() => setDetail(null));
  }, [requestId]);

  const matchedIds = new Set(detail?.crossMatches.filter((c) => c.result === "COMPATIBLE").map((c) => c.componentId));
  const reservations = detail?.reservations ?? [];
  const allMatched = reservations.length > 0 && reservations.every((r) => matchedIds.has(r.component.id));

  async function refresh() {
    if (requestId) setDetail((await getRequest(requestId)).request);
  }

  async function onCrossMatchAll() {
    if (!detail) return;
    setBusy(true);
    try {
      for (const r of detail.reservations) {
        if (!matchedIds.has(r.component.id)) await crossMatch(detail.id, r.component.id);
      }
      toast.success("Cross-match recorded");
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Cross-match failed");
    } finally {
      setBusy(false);
    }
  }

  async function onIssue() {
    if (!detail) return;
    setBusy(true);
    try {
      const barcodes = detail.reservations.map((r) => r.component.barcode);
      const res = await issueBlood(detail.id, barcodes);
      toast.success(`Issued · invoice ${res.invoice.number}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Issue failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!requestId} onOpenChange={(o) => !o && onDone()}>
      <SheetContent>
        {detail && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                Fulfil request <Badge variant="primary">{detail.bloodGroup} {detail.componentType}</Badge>
              </SheetTitle>
              <SheetDescription>
                {detail.patient?.name ?? detail.hospital?.name ?? "—"} · {detail.unitsRequested} requested ·{" "}
                {reservations.length} reserved
              </SheetDescription>
            </SheetHeader>

            <ul className="divide-y text-sm">
              {reservations.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="font-medium">{r.component.barcode}</div>
                    <div className="text-xs text-muted-foreground">exp {r.component.expiresAt.slice(0, 10)}</div>
                  </div>
                  {matchedIds.has(r.component.id) ? (
                    <Badge variant="success">Cross-matched</Badge>
                  ) : (
                    <Badge variant="warning">Pending match</Badge>
                  )}
                </li>
              ))}
              {reservations.length === 0 && (
                <li className="py-6 text-center text-muted-foreground">No reserved units.</li>
              )}
            </ul>

            <div className="mt-auto space-y-2">
              <Button variant="outline" className="w-full" disabled={busy || allMatched || reservations.length === 0} onClick={onCrossMatchAll}>
                {allMatched ? "All cross-matched" : "Cross-match all (compatible)"}
              </Button>
              <Button className="w-full" disabled={busy || !allMatched} onClick={onIssue}>
                Issue {reservations.length} unit{reservations.length === 1 ? "" : "s"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
