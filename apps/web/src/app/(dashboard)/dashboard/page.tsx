"use client";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataState,
  EmptyState,
  ListSkeleton,
} from "@bloodline/ui";
import {
  Activity as ActivityIcon,
  ArrowLeftRight,
  Boxes,
  Droplet,
  FlaskConical,
  Receipt,
  Send,
  Siren,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMinor } from "@/lib/operations";

interface Summary {
  todaysCollection: number;
  todaysIssued: number;
  openRequests: number;
  emergencies: number;
  pendingTests: number;
  todaysRevenueMinor: number;
  totalAvailableUnits: number;
  expiringSoon: number;
  expiringToday: number;
  criticalGroups: number;
}

interface GroupLevel {
  code: string;
  bloodGroup: string;
  available: number;
  critical: boolean;
}

interface Activity {
  id: string;
  kind: "collection" | "issue";
  at: string;
  text: string;
}

interface ExpiringUnit {
  id: string;
  barcode: string;
  type: string;
  bloodGroup: string;
  storageLocation: string | null;
  expiresAt: string;
}

interface Trend {
  date: string;
  count: number;
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "destructive" | "warning";
  href?: string;
}) {
  const toneText = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-primary";
  const toneBg = tone === "destructive" ? "bg-destructive/10" : tone === "warning" ? "bg-warning/10" : "bg-primary/10";
  const body = (
    <Card className="h-full transition-shadow hover:shadow-card">
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md ${toneBg} ${toneText}`}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-xl font-semibold text-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function TrendBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-24 items-end gap-0.5">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-primary/80"
          style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? "2px" : "0" }}
          title={`${v}`}
        />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [levels, setLevels] = useState<GroupLevel[]>();
  const [activity, setActivity] = useState<Activity[]>();
  const [expiring, setExpiring] = useState<ExpiringUnit[]>();
  const [trend, setTrend] = useState<Trend[]>();

  useEffect(() => {
    api<Summary>("/analytics/summary").then(setSummary).catch(() => setSummary(null));
    api<{ data: GroupLevel[] }>("/analytics/blood-group-levels").then((r) => setLevels(r.data)).catch(() => setLevels([]));
    api<{ data: Activity[] }>("/analytics/recent-activity").then((r) => setActivity(r.data)).catch(() => setActivity([]));
    api<{ data: ExpiringUnit[] }>("/analytics/expiring-units").then((r) => setExpiring(r.data)).catch(() => setExpiring([]));
    api<{ data: Trend[] }>("/analytics/collection-trends-dashboard").then((r) => setTrend(r.data)).catch(() => setTrend([]));
  }, []);

  return (
    <>
      <PageHeader title={`Welcome, ${user?.name ?? ""}`} description="Live operational snapshot across the bank." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {summary ? (
          <>
            <Kpi label="Available units" value={String(summary.totalAvailableUnits)} icon={Boxes} href="/inventory" />
            <Kpi label="Collected today" value={String(summary.todaysCollection)} icon={Droplet} href="/collection" />
            <Kpi label="Issued today" value={String(summary.todaysIssued)} icon={Send} href="/issue" />
            <Kpi label="Open requests" value={String(summary.openRequests)} icon={ArrowLeftRight} href="/requests" />
            <Kpi label="Emergencies" value={String(summary.emergencies)} icon={Siren} tone={summary.emergencies > 0 ? "destructive" : undefined} href="/requests" />
            <Kpi label="Pending lab tests" value={String(summary.pendingTests)} icon={FlaskConical} href="/lab" />
            <Kpi label="Expiring today" value={String(summary.expiringToday)} icon={TriangleAlert} tone={summary.expiringToday > 0 ? "warning" : undefined} />
            <Kpi label="Revenue today" value={formatMinor(summary.todaysRevenueMinor)} icon={Receipt} href="/billing" />
          </>
        ) : (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-3 w-16 rounded bg-secondary" />
                <div className="mt-2 h-6 w-12 rounded bg-secondary" />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Stock by blood group</CardTitle>
          <CardDescription>
            Available units per group{summary && summary.criticalGroups > 0 ? ` · ${summary.criticalGroups} group(s) critical` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {levels ? (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {levels.map((l) => (
                <div
                  key={l.code}
                  className={`rounded-lg border p-3 text-center ${l.critical ? "border-destructive/40 bg-destructive/5" : "bg-secondary/30"}`}
                >
                  <div className="text-sm font-semibold">{l.bloodGroup}</div>
                  <div className={`mt-1 text-xl font-bold ${l.critical ? "text-destructive" : "text-foreground"}`}>{l.available}</div>
                  {l.critical && <div className="text-[10px] font-medium uppercase text-destructive">low</div>}
                </div>
              ))}
            </div>
          ) : (
            <ListSkeleton rows={2} />
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest collections and issues</CardDescription>
          </CardHeader>
          <CardContent>
            <DataState
              loading={!activity}
              data={activity}
              empty={<EmptyState icon={<ActivityIcon className="size-6" />} title="No activity yet" />}
            >
              {(items) => (
                <ul className="divide-y">
                  {items.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        {a.kind === "collection" ? (
                          <Droplet className="size-4 shrink-0 text-primary" />
                        ) : (
                          <Send className="size-4 shrink-0 text-success" />
                        )}
                        {a.text}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(a.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </DataState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Units expiring soon</CardTitle>
            <CardDescription>First-expiry-first-out candidates (next 7 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <DataState
              loading={!expiring}
              data={expiring}
              empty={<EmptyState icon={<TriangleAlert className="size-6" />} title="Nothing expiring soon" />}
            >
              {(units) => (
                <ul className="divide-y">
                  {units.map((u) => {
                    const d = daysUntil(u.expiresAt);
                    return (
                      <li key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                        <span className="flex items-center gap-2">
                          <Badge variant="primary">{u.bloodGroup}</Badge>
                          <span>{u.type}</span>
                          <span className="font-mono text-xs text-muted-foreground">{u.barcode}</span>
                        </span>
                        <Badge variant={d <= 1 ? "destructive" : "warning"}>{d <= 0 ? "today" : `${d}d`}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </DataState>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Collection (last 30 days)</CardTitle>
          <CardDescription>Daily donations recorded</CardDescription>
        </CardHeader>
        <CardContent>{trend ? <TrendBars values={trend.map((t) => t.count)} /> : <ListSkeleton rows={2} />}</CardContent>
      </Card>
    </>
  );
}
