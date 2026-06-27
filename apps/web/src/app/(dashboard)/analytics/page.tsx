"use client";

import { Card, CardContent, CardHeader, CardTitle, ListSkeleton } from "@bloodline/ui";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";

interface Trend { date: string; count: number }
interface Demand { bloodGroup: string; units: number }
interface TopDonor { id: string; name: string; bloodGroup: string; donationCount: number }
interface Revenue { date: string; amountMinor: number }

function MiniBars({ values, labels, color = "bg-primary" }: { values: number[]; labels?: string[]; color?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-32 items-end gap-1">
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className={`w-full rounded-t ${color}`} style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? "2px" : "0" }} title={`${labels?.[i] ?? ""}: ${v}`} />
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [trend, setTrend] = useState<Trend[]>();
  const [demand, setDemand] = useState<Demand[]>();
  const [donors, setDonors] = useState<TopDonor[]>();
  const [revenue, setRevenue] = useState<Revenue[]>();

  useEffect(() => {
    api<{ data: Trend[] }>("/analytics/collection-trends").then((r) => setTrend(r.data)).catch(() => setTrend([]));
    api<{ data: Demand[] }>("/analytics/demand-by-group").then((r) => setDemand(r.data)).catch(() => setDemand([]));
    api<{ data: TopDonor[] }>("/analytics/top-donors").then((r) => setDonors(r.data)).catch(() => setDonors([]));
    api<{ data: Revenue[] }>("/analytics/revenue").then((r) => setRevenue(r.data)).catch(() => setRevenue([]));
  }, []);

  return (
    <>
      <PageHeader title="Analytics" description="Trends and rankings across collection, demand and revenue." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Collection (last 30 days)</CardTitle></CardHeader>
          <CardContent>
            {trend ? <MiniBars values={trend.map((t) => t.count)} labels={trend.map((t) => t.date)} /> : <ListSkeleton rows={3} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Revenue (last 30 days)</CardTitle></CardHeader>
          <CardContent>
            {revenue ? <MiniBars values={revenue.map((r) => r.amountMinor)} labels={revenue.map((r) => r.date)} color="bg-success" /> : <ListSkeleton rows={3} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Demand by blood group</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {demand ? (
              demand.length === 0 ? <p className="text-sm text-muted-foreground">No requests yet.</p> :
              demand.map((d) => {
                const max = Math.max(1, ...demand.map((x) => x.units));
                return (
                  <div key={d.bloodGroup} className="flex items-center gap-2 text-sm">
                    <span className="w-10 text-muted-foreground">{d.bloodGroup}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded bg-secondary">
                      <div className="h-full rounded bg-primary" style={{ width: `${(d.units / max) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right">{d.units}</span>
                  </div>
                );
              })
            ) : <ListSkeleton rows={4} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top donors</CardTitle></CardHeader>
          <CardContent>
            {donors ? (
              donors.length === 0 ? <p className="text-sm text-muted-foreground">No donors yet.</p> :
              <ul className="divide-y text-sm">
                {donors.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2">
                    <span>{d.name} <span className="text-muted-foreground">· {d.bloodGroup}</span></span>
                    <span className="font-medium">{d.donationCount}</span>
                  </li>
                ))}
              </ul>
            ) : <ListSkeleton rows={4} />}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
