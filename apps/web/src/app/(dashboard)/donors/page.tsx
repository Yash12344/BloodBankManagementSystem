"use client";

import { BLOOD_GROUP_LABEL } from "@bloodline/types";
import {
  Badge,
  Button,
  Card,
  DataState,
  EmptyState,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  toast,
} from "@bloodline/ui";
import { Heart } from "lucide-react";
import { useState } from "react";
import { AddDonorDialog } from "@/components/donors/add-donor-dialog";
import { PageHeader } from "@/components/page-header";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { recallDonor, recordDonation, useDonors, type Donor } from "@/lib/donors";

function groupLabel(g: string) {
  return BLOOD_GROUP_LABEL[g as keyof typeof BLOOD_GROUP_LABEL] ?? g;
}

function EligibilityBadge({ donor }: { donor: Donor }) {
  return donor.eligibility.eligible ? (
    <Badge variant="success">Eligible</Badge>
  ) : (
    <Badge variant="warning">Not eligible</Badge>
  );
}

export default function DonorsPage() {
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [eligible, setEligible] = useState<"" | "true" | "false">("");
  const { data, loading, error, refetch } = useDonors({
    q: q || undefined,
    eligible: eligible || undefined,
  });
  const [selected, setSelected] = useState<Donor | null>(null);
  const [donating, setDonating] = useState(false);

  async function onRecordDonation(donor: Donor) {
    setDonating(true);
    try {
      await recordDonation(donor.id);
      toast.success(`Donation recorded for ${donor.name}`);
      setSelected(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record donation");
    } finally {
      setDonating(false);
    }
  }

  async function onRecall(donor: Donor) {
    const reason = window.prompt(`Recall all units from ${donor.name}? Enter a reason:`);
    if (!reason) return;
    setDonating(true);
    try {
      const r = await recallDonor(donor.id, reason);
      toast.success(`Recall done · ${r.quarantined} quarantined, ${r.notifiedHospitals} hospital(s) notified`);
      setSelected(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Recall failed");
    } finally {
      setDonating(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Donors"
        description="Register donors and track eligibility and donation history."
        actions={can("donors", "create") ? <AddDonorDialog onCreated={refetch} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name, code or mobile…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={eligible}
          onChange={(e) => setEligible(e.target.value as "" | "true" | "false")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All</option>
          <option value="true">Eligible</option>
          <option value="false">Not eligible</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <DataState
          loading={loading}
          error={error}
          data={data}
          onRetry={refetch}
          empty={
            <EmptyState
              icon={<Heart className="size-6" />}
              title="No donors yet"
              description="Register your first donor to get started."
            />
          }
        >
          {(donors) => (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Donor</th>
                  <th className="px-4 py-2.5 font-medium">Group</th>
                  <th className="px-4 py-2.5 font-medium">Last donation</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {donors.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className="cursor-pointer border-b last:border-0 hover:bg-secondary/50"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.donorCode} · {d.mobile}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="primary">{groupLabel(d.bloodGroup)}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {d.lastDonationAt ? d.lastDonationAt.slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <EligibilityBadge donor={d} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataState>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.name} <Badge variant="primary">{groupLabel(selected.bloodGroup)}</Badge>
                </SheetTitle>
                <SheetDescription>
                  {selected.donorCode} · {selected.gender} · {selected.weightKg} kg
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Eligibility</span>
                  <EligibilityBadge donor={selected} />
                </div>
                {!selected.eligibility.eligible && selected.eligibility.reasons.length > 0 && (
                  <ul className="list-inside list-disc rounded-md bg-secondary/50 p-3 text-xs text-muted-foreground">
                    {selected.eligibility.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Donations</span>
                  <span>{selected.donationCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last donation</span>
                  <span>{selected.lastDonationAt ? selected.lastDonationAt.slice(0, 10) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Next eligible</span>
                  <span>{selected.nextEligibleAt ? selected.nextEligibleAt.slice(0, 10) : "Now"}</span>
                </div>
              </div>

              <div className="mt-auto space-y-2">
                {can("collection", "create") && (
                  <Button
                    className="w-full"
                    disabled={donating || !selected.eligibility.eligible}
                    onClick={() => onRecordDonation(selected)}
                  >
                    {selected.eligibility.eligible ? "Record donation" : "Not eligible to donate"}
                  </Button>
                )}
                {can("lab", "approve") && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={donating}
                    onClick={() => onRecall(selected)}
                  >
                    Recall (look-back)
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
