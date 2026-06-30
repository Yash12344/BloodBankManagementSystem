"use client";

import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@bloodline/ui";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  Droplets,
  FileBarChart,
  FlaskConical,
  Heart,
  LayoutDashboard,
  Receipt,
  Send,
  Settings,
  Tent,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NAV } from "@/lib/navigation";
import { useUiStore } from "@/stores/ui-store";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  donors: Heart,
  collection: Droplets,
  lab: FlaskConical,
  inventory: Boxes,
  patients: UserRound,
  requests: ArrowLeftRight,
  issue: Send,
  hospitals: Building2,
  camps: Tent,
  staff: Users,
  billing: Receipt,
  reports: FileBarChart,
  analytics: BarChart3,
  settings: Settings,
};

export function Sidebar() {
  const pathname = usePathname();
  const { can } = useAuth();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  const items = NAV.filter((n) => can(n.module, "view"));

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r bg-card p-3 transition-all md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="mb-4 flex items-center gap-2 px-2 py-1">
        <span className="inline-flex size-8 items-center justify-center rounded-card bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
          <Heart className="size-4 fill-current" />
        </span>
        {!collapsed && <span className="font-semibold tracking-tight">BloodLine</span>}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((n) => {
          const Icon = ICONS[n.module] ?? LayoutDashboard;
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          const link = (
            <Link
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span>{n.label}</span>}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={n.module}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{n.label}</TooltipContent>
            </Tooltip>
          ) : (
            <div key={n.module}>{link}</div>
          );
        })}
      </nav>

      <div className={cn("mt-3 border-t px-3 pt-3 text-[11px] text-muted-foreground", collapsed && "text-center")}>
        {collapsed ? "v0.1" : "BloodLine · v0.1"}
      </div>
    </aside>
  );
}
