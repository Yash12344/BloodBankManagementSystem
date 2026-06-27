"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataState,
  EmptyState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  toast,
} from "@bloodline/ui";
import { Droplets, Send, TriangleAlert } from "lucide-react";
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
}

interface Kpi {
  label: string;
  value: string;
  tone?: "destructive";
}

function kpisFrom(s: Summary): Kpi[] {
  return [
    { label: "Today's collection", value: String(s.todaysCollection) },
    { label: "Blood issued", value: String(s.todaysIssued) },
    { label: "Open requests", value: String(s.openRequests) },
    { label: "Emergency", value: String(s.emergencies), tone: s.emergencies > 0 ? "destructive" : undefined },
    { label: "Pending tests", value: String(s.pendingTests) },
    { label: "Today's revenue", value: formatMinor(s.todaysRevenueMinor) },
  ];
}

interface Activity {
  id: string;
  text: string;
  at: string;
}

const SAMPLE: Activity[] = [
  { id: "1", text: "Issued 2× PRBC to Apollo Hospital", at: "10:24" },
  { id: "2", text: "Lab approved unit #B2381 (O+)", at: "10:02" },
  { id: "3", text: "Donor R. Mehta collected — 450ml", at: "09:40" },
];

export default function DashboardPage() {
  const { user } = useAuth();

  const [summary, setSummary] = useState<Summary | null>(null);

  // Demonstrate the async DataState pattern: skeleton → data.
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    api<Summary>("/analytics/summary").then(setSummary).catch(() => setSummary(null));
    const t = setTimeout(() => {
      setActivity(SAMPLE);
      setLoading(false);
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const kpis = summary ? kpisFrom(summary) : [];

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name ?? ""}`}
        description="Live operational snapshot across the bank."
        actions={
          <Button
            onClick={() =>
              toast("Draft saved", {
                description: "Undo within 5 seconds",
                action: { label: "Undo", onClick: () => toast.success("Reverted") },
              })
            }
          >
            Quick action
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-2xl font-semibold">{k.value}</span>
                {k.tone === "destructive" && Number(k.value) > 0 && <Badge variant="destructive">live</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest events across the bank</CardDescription>
          </CardHeader>
          <CardContent>
            <DataState
              loading={loading}
              data={activity}
              empty={<EmptyState icon={<Droplets className="size-6" />} title="No activity yet" />}
            >
              {(items) => (
                <ul className="divide-y">
                  {items.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span>{a.text}</span>
                      <span className="text-xs text-muted-foreground">{a.at}</span>
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
            <CardDescription>First-expiry-first-out candidates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm transition-colors hover:bg-secondary"
            >
              <span className="flex items-center gap-2">
                <TriangleAlert className="size-4 text-warning" />
                PRBC O+ · #B2381
              </span>
              <Badge variant="warning">in 2 days</Badge>
            </button>
            <p className="text-xs text-muted-foreground">Select a unit to open its detail drawer.</p>
          </CardContent>
        </Card>
      </div>

      {/* Detail drawer pattern reused across modules */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Unit #B2381 <Badge variant="primary">O+</Badge>
            </SheetTitle>
            <SheetDescription>PRBC · prepared 3 days ago · Fridge-2 / R3</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="success">Available</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expires</span>
              <span>in 2 days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume</span>
              <span>280 ml</span>
            </div>
          </div>
          <div className="mt-auto flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDrawerOpen(false)}>
              Close
            </Button>
            <Button className="flex-1 gap-2">
              <Send className="size-4" /> Reserve
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
