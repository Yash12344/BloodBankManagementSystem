"use client";

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@bloodline/ui";
import { Bell } from "lucide-react";
import { useNotifications } from "@/lib/notifications";

export function NotificationBell() {
  const { items, unread, loadList, markAllRead } = useNotifications();

  return (
    <DropdownMenu onOpenChange={(o) => o && loadList()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className="px-3 py-2.5">
                  <div className="text-sm font-medium">{n.payload.title ?? n.type}</div>
                  {n.payload.message && <div className="text-xs text-muted-foreground">{n.payload.message}</div>}
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
