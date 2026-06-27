"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface AppNotification {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  payload: { title?: string; message?: string } & Record<string, unknown>;
}

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const refreshCount = useCallback(() => {
    api<{ count: number }>("/notifications/unread-count").then((r) => setUnread(r.count)).catch(() => {});
  }, []);

  const loadList = useCallback(() => {
    api<{ data: AppNotification[] }>("/notifications").then((r) => setItems(r.data)).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    await api("/notifications/read-all", { method: "POST" }).catch(() => {});
    setUnread(0);
    loadList();
  }, [loadList]);

  // Poll the unread count every 30s.
  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 30_000);
    return () => clearInterval(t);
  }, [refreshCount]);

  return { items, unread, loadList, markAllRead };
}
