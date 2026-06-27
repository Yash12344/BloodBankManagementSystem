"use client";

import { Badge, Button, Card, DataState, EmptyState, toast } from "@bloodline/ui";
import { Users } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { post, useList, type StaffMember } from "@/lib/operations";

export default function StaffPage() {
  const { can } = useAuth();
  const { data, loading, error, refetch } = useList<StaffMember>("/staff");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function markPresent(s: StaffMember) {
    setBusyId(s.id);
    try {
      await post(`/staff/${s.id}/attendance`, { date: new Date().toISOString(), status: "PRESENT" });
      toast.success(`${s.name} marked present`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Staff" description="Team members, roles and attendance." />
      <Card className="overflow-hidden">
        <DataState
          loading={loading}
          error={error}
          data={data}
          onRetry={refetch}
          empty={<EmptyState icon={<Users className="size-6" />} title="No staff" />}
        >
          {(rows) => (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Department</th>
                  <th className="px-4 py-2.5 font-medium text-right">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </td>
                    <td className="px-4 py-2.5"><Badge variant="primary">{s.role.name}</Badge></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.staffProfile?.department ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      {can("staff", "edit") && (
                        <Button size="sm" variant="outline" disabled={busyId === s.id} onClick={() => markPresent(s)}>
                          Mark present
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
    </>
  );
}
