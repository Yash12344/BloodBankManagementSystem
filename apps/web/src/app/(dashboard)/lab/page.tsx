"use client";

import { BLOOD_GROUP_LABEL } from "@bloodline/types";
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
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { approveUnit, recordTests, rejectUnit, useLabWorklist, type LabRow, type Marker } from "@/lib/lab";

const TTI: { key: keyof Pick<LabRow, "hiv" | "hbsag" | "hcv" | "malaria" | "syphilis">; label: string }[] = [
  { key: "hiv", label: "HIV" },
  { key: "hbsag", label: "HBsAg" },
  { key: "hcv", label: "HCV" },
  { key: "malaria", label: "Malaria" },
  { key: "syphilis", label: "Syphilis" },
];

const MARKERS: Marker[] = ["PENDING", "NON_REACTIVE", "REACTIVE"];
const FIELD = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function groupLabel(g: string) {
  return BLOOD_GROUP_LABEL[g as keyof typeof BLOOD_GROUP_LABEL] ?? g;
}

export default function LabPage() {
  const { can } = useAuth();
  const { data, loading, error, refetch } = useLabWorklist();
  const [sel, setSel] = useState<LabRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function open(row: LabRow) {
    setSel(row);
    setForm({
      hb: row.hb?.toString() ?? "",
      hiv: row.hiv,
      hbsag: row.hbsag,
      hcv: row.hcv,
      malaria: row.malaria,
      syphilis: row.syphilis,
      forwardGroup: row.forwardGroup ?? "",
      rh: row.rh ?? "",
    });
  }

  async function run(action: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      setSel(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Laboratory" description="Screen collected units. Reactive results block approval and discard the unit." />

      <Card className="overflow-hidden">
        <DataState
          loading={loading}
          error={error}
          data={data}
          onRetry={refetch}
          empty={<EmptyState icon={<FlaskConical className="size-6" />} title="No units awaiting screening" />}
        >
          {(rows) => (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Bag</th>
                  <th className="px-4 py-2.5 font-medium">Group</th>
                  <th className="px-4 py-2.5 font-medium">Donor</th>
                  <th className="px-4 py-2.5 font-medium">Unit status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => open(r)} className="cursor-pointer border-b last:border-0 hover:bg-secondary/50">
                    <td className="px-4 py-2.5 font-medium">{r.unit.bagNumber}</td>
                    <td className="px-4 py-2.5"><Badge variant="primary">{groupLabel(r.unit.bloodGroup)}</Badge></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.unit.donation?.donor?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={r.unit.status === "QUARANTINED" ? "destructive" : "default"}>{r.unit.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataState>
      </Card>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="sm:max-w-lg">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {sel.unit.bagNumber} <Badge variant="primary">{groupLabel(sel.unit.bloodGroup)}</Badge>
                </SheetTitle>
                <SheetDescription>Record screening results, then approve or reject.</SheetDescription>
              </SheetHeader>

              <div className="space-y-3 overflow-y-auto">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label>Hb (g/dL)</Label>
                    <Input value={form.hb ?? ""} onChange={(e) => setForm({ ...form, hb: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Group</Label>
                    <Input value={form.forwardGroup ?? ""} onChange={(e) => setForm({ ...form, forwardGroup: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Rh</Label>
                    <Input value={form.rh ?? ""} onChange={(e) => setForm({ ...form, rh: e.target.value })} />
                  </div>
                </div>
                {TTI.map((m) => (
                  <div key={m.key} className="flex items-center justify-between gap-2">
                    <Label className="flex-1">{m.label}</Label>
                    <select
                      value={form[m.key] ?? "PENDING"}
                      onChange={(e) => setForm({ ...form, [m.key]: e.target.value })}
                      className={FIELD + " max-w-44"}
                    >
                      {MARKERS.map((v) => (
                        <option key={v} value={v}>{v.replace("_", "-")}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="mt-auto space-y-2">
                {can("lab", "edit") && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={() => run(() => recordTests(sel.unitId, form), "Tests saved")}
                  >
                    Save tests
                  </Button>
                )}
                {can("lab", "approve") && (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt("Reason for rejection?");
                        if (reason) run(() => rejectUnit(sel.unitId, reason), "Unit rejected");
                      }}
                    >
                      Reject
                    </Button>
                    <Button className="flex-1" disabled={busy} onClick={() => run(() => approveUnit(sel.unitId), "Unit approved")}>
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
