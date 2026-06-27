"use client";

import { BLOOD_GROUP_LABEL } from "@bloodline/types";
import { Badge, Button, Card, DataState, EmptyState, toast } from "@bloodline/ui";
import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { AddRequestDialog } from "@/components/requests/add-request-dialog";
import { FulfilDrawer } from "@/components/requests/fulfil-drawer";
import { PageHeader } from "@/components/page-header";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { approveRequest, useRequests, type BloodRequest } from "@/lib/requests";

function groupLabel(g: string) {
  return BLOOD_GROUP_LABEL[g as keyof typeof BLOOD_GROUP_LABEL] ?? g;
}

const STATUS_VARIANT: Record<string, "default" | "primary" | "success" | "warning" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "primary",
  COMPLETED: "success",
  REJECTED: "destructive",
  CANCELLED: "default",
};

export default function RequestsPage() {
  const { can } = useAuth();
  const { data, loading, error, refetch } = useRequests();
  const [fulfilId, setFulfilId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onApprove(r: BloodRequest) {
    setBusyId(r.id);
    try {
      const res = await approveRequest(r.id);
      toast.success(
        res.shortfall > 0
          ? `Approved · reserved ${res.reserved}/${res.requested} (short ${res.shortfall})`
          : `Approved · reserved ${res.reserved} unit(s)`,
      );
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Blood requests"
        description="Approve to reserve units (FEFO), then cross-match and issue."
        actions={can("requests", "create") ? <AddRequestDialog onCreated={refetch} /> : undefined}
      />

      <Card className="overflow-hidden">
        <DataState
          loading={loading}
          error={error}
          data={data}
          onRetry={refetch}
          empty={<EmptyState icon={<ArrowLeftRight className="size-6" />} title="No requests yet" />}
        >
          {(rows) => (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Requirement</th>
                  <th className="px-4 py-2.5 font-medium">For</th>
                  <th className="px-4 py-2.5 font-medium">Priority</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{r.unitsRequested}×</span>{" "}
                      <Badge variant="primary">{groupLabel(r.bloodGroup)}</Badge> {r.componentType}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.patient?.name ?? r.hospital?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {r.priority === "CRITICAL" ? <Badge variant="destructive">Critical</Badge> : <span className="text-muted-foreground">Normal</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANT[r.status] ?? "default"}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {r.status === "PENDING" && can("requests", "approve") && (
                        <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => onApprove(r)}>
                          Approve
                        </Button>
                      )}
                      {r.status === "APPROVED" && can("issue", "create") && (
                        <Button size="sm" onClick={() => setFulfilId(r.id)}>
                          Fulfil
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataState>
      </Card>

      <FulfilDrawer
        requestId={fulfilId}
        onDone={() => {
          setFulfilId(null);
          refetch();
        }}
      />
    </>
  );
}
