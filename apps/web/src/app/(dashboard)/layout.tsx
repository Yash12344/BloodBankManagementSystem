"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

// Modules shown in the sidebar, each gated by a permission the user must hold.
const NAV: { label: string; module: string }[] = [
  { label: "Dashboard", module: "dashboard" },
  { label: "Donors", module: "donors" },
  { label: "Collection", module: "collection" },
  { label: "Lab", module: "lab" },
  { label: "Inventory", module: "inventory" },
  { label: "Requests", module: "requests" },
  { label: "Issue", module: "issue" },
  { label: "Hospitals", module: "hospitals" },
  { label: "Camps", module: "camps" },
  { label: "Billing", module: "billing" },
  { label: "Reports", module: "reports" },
  { label: "Settings", module: "settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, logout, can } = useAuth();

  // Client-side guard: redirect to login once we know there is no session.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-200 p-4 dark:border-zinc-800 md:block">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-card bg-accent-soft text-accent">♥</span>
          <span className="font-semibold">BloodLine</span>
        </div>
        <nav className="space-y-1">
          {NAV.filter((n) => can(n.module, "view")).map((n) => (
            <a
              key={n.module}
              href={`/${n.module}`}
              className="block rounded-[10px] px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {n.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <div className="text-sm text-zinc-500">{user.role}</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">{user.name}</span>
            <button onClick={() => logout()} className="text-accent hover:underline">
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
