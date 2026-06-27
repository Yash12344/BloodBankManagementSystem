"use client";

import type { Paginated } from "@bloodline/types";
import { Badge, Card, CardContent, CardHeader, CardTitle, ListSkeleton } from "@bloodline/ui";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";

interface Org { name: string; code: string; organization: { name: string; gstin: string | null } }
interface User { id: string; name: string; email: string; status: string; role: { name: string }; lastLoginAt: string | null }
interface RolePerm { role: string; permissions: string[] }
interface AuditLog { id: string; entity: string; action: string; createdAt: string; user: { name: string } | null }

export default function SettingsPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [users, setUsers] = useState<User[]>();
  const [roles, setRoles] = useState<RolePerm[]>();
  const [logs, setLogs] = useState<AuditLog[]>();

  useEffect(() => {
    api<{ organization: Org }>("/settings/organization").then((r) => setOrg(r.organization)).catch(() => {});
    api<{ data: User[] }>("/settings/users").then((r) => setUsers(r.data)).catch(() => setUsers([]));
    api<{ data: RolePerm[] }>("/settings/permissions").then((r) => setRoles(r.data)).catch(() => setRoles([]));
    api<Paginated<AuditLog>>("/settings/audit-logs").then((r) => setLogs(r.data)).catch(() => setLogs([]));
  }, []);

  return (
    <>
      <PageHeader title="Settings" description="Organization, users, roles and the audit trail." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Organization</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {org ? (
              <>
                <Row label="Organization" value={org.organization.name} />
                <Row label="Branch" value={`${org.name} (${org.code})`} />
                <Row label="GSTIN" value={org.organization.gstin ?? "—"} />
              </>
            ) : <ListSkeleton rows={2} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Roles &amp; permissions</CardTitle></CardHeader>
          <CardContent>
            {roles ? (
              <ul className="divide-y text-sm">
                {roles.map((r) => (
                  <li key={r.role} className="flex items-center justify-between py-2">
                    <span>{r.role}</span>
                    <Badge variant="default">{r.permissions.length} perms</Badge>
                  </li>
                ))}
              </ul>
            ) : <ListSkeleton rows={4} />}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader><CardTitle>Users</CardTitle></CardHeader>
        <CardContent className="p-0">
          {users ? (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Role</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Last login</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="px-4 py-2"><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                    <td className="px-4 py-2"><Badge variant="primary">{u.role.name}</Badge></td>
                    <td className="px-4 py-2">{u.status}</td>
                    <td className="px-4 py-2 text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="p-4"><ListSkeleton rows={3} /></div>}
        </CardContent>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <CardHeader><CardTitle>Recent audit log</CardTitle></CardHeader>
        <CardContent className="p-0">
          {logs ? (
            <ul className="divide-y text-sm">
              {logs.slice(0, 20).map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-2">
                  <span><span className="font-medium">{l.action}</span> <span className="text-muted-foreground">on {l.entity}</span></span>
                  <span className="text-xs text-muted-foreground">{l.user?.name ?? "system"} · {new Date(l.createdAt).toLocaleString()}</span>
                </li>
              ))}
              {logs.length === 0 && <li className="px-4 py-6 text-center text-muted-foreground">No audit entries.</li>}
            </ul>
          ) : <div className="p-4"><ListSkeleton rows={4} /></div>}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
