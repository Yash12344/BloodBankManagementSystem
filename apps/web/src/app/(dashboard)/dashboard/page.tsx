"use client";

import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Welcome, {user?.name}</h1>
      <p className="text-zinc-500">
        Authentication and role-based access are live. KPI cards, charts and the module
        screens arrive in the next phases.
      </p>
      <div className="rounded-card border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <div className="mb-2 font-medium">Your effective permissions ({user?.permissions.length ?? 0})</div>
        <div className="flex flex-wrap gap-1">
          {user?.permissions.slice(0, 40).map((p) => (
            <span key={p} className="rounded-pill bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
